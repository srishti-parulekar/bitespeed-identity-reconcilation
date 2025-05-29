import pool from "../config/db.js";
import Joi from "joi";

// Validation schema
const identifySchema = Joi.object({
    email: Joi.string().email().optional(),
    phoneNumber: Joi.string().optional()
}).or('email', 'phoneNumber'); // At least one must be present

// Main identify function
export const identifyUser = async (req, res) => {
    try {
        // Validate input
        const { error, value } = identifySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: "At least one of email or phoneNumber must be provided",
                details: error.details[0].message
            });
        }

        const { email, phoneNumber } = value;

        // Start transaction
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Find existing contacts with matching email or phone
            const existingContacts = await findExistingContacts(client, email, phoneNumber);

            let response;

            if (existingContacts.length === 0) {
                // No existing contact found - create new primary contact
                response = await createNewPrimaryContact(client, email, phoneNumber);
            } else {
                // Process existing contacts
                response = await processExistingContacts(client, existingContacts, email, phoneNumber);
            }

            await client.query('COMMIT');
            res.status(200).json(response);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error in identifyUser:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper function to find existing contacts
async function findExistingContacts(client, email, phoneNumber) {
    let query = `
        SELECT id, phone_number, email, linked_id, link_precedence, created_at, updated_at
        FROM contacts 
        WHERE deleted_at IS NULL AND (
    `;
    
    const params = [];
    const conditions = [];
    
    if (email) {
        conditions.push(`email = $${params.length + 1}`);
        params.push(email);
    }
    
    if (phoneNumber) {
        conditions.push(`phone_number = $${params.length + 1}`);
        params.push(phoneNumber);
    }
    
    query += conditions.join(' OR ') + ')';
    
    const result = await client.query(query, params);
    return result.rows;
}

// Create new primary contact
async function createNewPrimaryContact(client, email, phoneNumber) {
    const insertQuery = `
        INSERT INTO contacts (email, phone_number, linked_id, link_precedence, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id, phone_number, email, linked_id, link_precedence, created_at, updated_at
    `;
    
    const result = await client.query(insertQuery, [email, phoneNumber, null, 'primary']);
    const newContact = result.rows[0];
    
    return {
        contact: {
            primaryContatctId: newContact.id,
            emails: newContact.email ? [newContact.email] : [],
            phoneNumbers: newContact.phone_number ? [newContact.phone_number] : [],
            secondaryContactIds: []
        }
    };
}

// Process existing contacts
async function processExistingContacts(client, existingContacts, email, phoneNumber) {
    // Get all primary contacts from the existing contacts
    const primaryContacts = [];
    
    for (const contact of existingContacts) {
        if (contact.link_precedence === 'primary') {
            primaryContacts.push(contact);
        } else {
            // If it's secondary, get its primary
            const primaryResult = await client.query(
                'SELECT * FROM contacts WHERE id = $1 AND deleted_at IS NULL',
                [contact.linked_id]
            );
            if (primaryResult.rows.length > 0) {
                const primary = primaryResult.rows[0];
                if (!primaryContacts.find(p => p.id === primary.id)) {
                    primaryContacts.push(primary);
                }
            }
        }
    }

    // Determine the master primary (oldest one)
    const masterPrimary = primaryContacts.reduce((oldest, current) => {
        return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
    });

    // If there are multiple primaries, merge them
    if (primaryContacts.length > 1) {
        await mergePrimaryContacts(client, primaryContacts, masterPrimary);
    }

    // Check if we need to create a new secondary contact
    const needsNewContact = await checkIfNeedsNewContact(client, masterPrimary.id, email, phoneNumber);
    
    if (needsNewContact) {
        await createSecondaryContact(client, email, phoneNumber, masterPrimary.id);
    }

    // Get consolidated response
    return await getConsolidatedResponse(client, masterPrimary.id);
}

// Merge multiple primary contacts
async function mergePrimaryContacts(client, primaryContacts, masterPrimary) {
    for (const primary of primaryContacts) {
        if (primary.id !== masterPrimary.id) {
            // Convert this primary to secondary
            await client.query(
                'UPDATE contacts SET linked_id = $1, link_precedence = $2, updated_at = NOW() WHERE id = $3',
                [masterPrimary.id, 'secondary', primary.id]
            );

            // Update all contacts that were linked to this primary
            await client.query(
                'UPDATE contacts SET linked_id = $1, updated_at = NOW() WHERE linked_id = $2',
                [masterPrimary.id, primary.id]
            );
        }
    }
}

// Check if we need to create a new contact
async function checkIfNeedsNewContact(client, primaryId, email, phoneNumber) {
    // Get all contacts in this group
    const allContacts = await client.query(`
        SELECT email, phone_number 
        FROM contacts 
        WHERE deleted_at IS NULL AND (id = $1 OR linked_id = $1)
    `, [primaryId]);

    // Check if exact combination already exists
    const exactMatch = allContacts.rows.find(contact => 
        contact.email === email && contact.phone_number === phoneNumber
    );

    return !exactMatch;
}

// Create secondary contact
async function createSecondaryContact(client, email, phoneNumber, linkedId) {
    await client.query(`
        INSERT INTO contacts (email, phone_number, linked_id, link_precedence, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
    `, [email, phoneNumber, linkedId, 'secondary']);
}

// Get consolidated response
async function getConsolidatedResponse(client, primaryId) {
    const allContactsResult = await client.query(`
        SELECT id, email, phone_number, link_precedence, created_at
        FROM contacts 
        WHERE deleted_at IS NULL AND (id = $1 OR linked_id = $1)
        ORDER BY 
            CASE WHEN link_precedence = 'primary' THEN 0 ELSE 1 END,
            created_at ASC
    `, [primaryId]);

    const allContacts = allContactsResult.rows;
    const primaryContact = allContacts.find(c => c.link_precedence === 'primary');
    const secondaryContacts = allContacts.filter(c => c.link_precedence === 'secondary');

    // Collect all unique emails and phone numbers
    const emails = [];
    const phoneNumbers = [];

    // Add primary contact info first
    if (primaryContact.email) emails.push(primaryContact.email);
    if (primaryContact.phone_number) phoneNumbers.push(primaryContact.phone_number);

    // Add secondary contact info
    for (const contact of secondaryContacts) {
        if (contact.email && !emails.includes(contact.email)) {
            emails.push(contact.email);
        }
        if (contact.phone_number && !phoneNumbers.includes(contact.phone_number)) {
            phoneNumbers.push(contact.phone_number);
        }
    }

    return {
        contact: {
            primaryContatctId: primaryContact.id,
            emails: emails,
            phoneNumbers: phoneNumbers,
            secondaryContactIds: secondaryContacts.map(c => c.id)
        }
    };
}

// Create order function (placeholder)
export const createOrder = async (req, res) => {
    try {
        // This is a placeholder - you can implement order creation logic here
        res.status(200).json({ message: "Order creation endpoint - to be implemented" });
    } catch (error) {
        console.error('Error in createOrder:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};