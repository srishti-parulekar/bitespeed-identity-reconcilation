import prisma from '../config/prisma.js';

class ContactService {
  async findExistingContacts(email, phoneNumber) {
    const whereConditions = [];
    
    if (email) {
      whereConditions.push({ email });
    }
    
    if (phoneNumber) {
      whereConditions.push({ phoneNumber });
    }

    if (whereConditions.length === 0) {
      return [];
    }

    return await prisma.contact.findMany({
      where: {
        AND: [
          { deletedAt: null },
          { OR: whereConditions }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getLinkedContacts(primaryId) {
    return await prisma.contact.findMany({
      where: {
        AND: [
          { deletedAt: null },
          {
            OR: [
              { id: primaryId },
              { linkedId: primaryId }
            ]
          }
        ]
      },
      orderBy: [
        { linkPrecedence: 'asc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async createPrimaryContact(email, phoneNumber) {
    return await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'primary'
      }
    });
  }

  async createSecondaryContact(email, phoneNumber, linkedId) {
    return await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkedId,
        linkPrecedence: 'secondary'
      }
    });
  }

  async convertToSecondary(contactId, newLinkedId) {
    return await prisma.contact.update({
      where: { id: contactId },
      data: {
        linkedId: newLinkedId,
        linkPrecedence: 'secondary'
      }
    });
  }

  async updateLinkedContacts(oldPrimaryId, newPrimaryId) {
    return await prisma.contact.updateMany({
      where: { linkedId: oldPrimaryId },
      data: { linkedId: newPrimaryId }
    });
  }

  async contactExists(email, phoneNumber, primaryId) {
    const contacts = await this.getLinkedContacts(primaryId);
    
    return contacts.some(contact => 
      contact.email === email && contact.phoneNumber === phoneNumber
    );
  }

  async getAllPrimaryContacts(contacts) {
    const primaries = [];
    
    for (const contact of contacts) {
      if (contact.linkPrecedence === 'primary') {
        primaries.push(contact);
      } else if (contact.linkedId) {
        const primary = await prisma.contact.findUnique({
          where: { 
            id: contact.linkedId,
            deletedAt: null 
          }
        });
        
        if (primary && !primaries.find(p => p.id === primary.id)) {
          primaries.push(primary);
        }
      }
    }
    
    return primaries;
  }

  getMasterPrimary(primaryContacts) {
    return primaryContacts.reduce((oldest, current) => {
      return new Date(current.createdAt) < new Date(oldest.createdAt) 
        ? current 
        : oldest;
    });
  }

  async mergePrimaryContacts(primaryContacts, masterPrimary) {
    const transaction = await prisma.$transaction(async (tx) => {
      const updates = [];

      for (const primary of primaryContacts) {
        if (primary.id !== masterPrimary.id) {
          updates.push(
            tx.contact.update({
              where: { id: primary.id },
              data: {
                linkedId: masterPrimary.id,
                linkPrecedence: 'secondary'
              }
            })
          );

          updates.push(
            tx.contact.updateMany({
              where: { linkedId: primary.id },
              data: { linkedId: masterPrimary.id }
            })
          );
        }
      }

      return await Promise.all(updates);
    });

    return transaction;
  }

  buildConsolidatedResponse(contacts) {
    const primary = contacts.find(c => c.linkPrecedence === 'primary');
    const secondaries = contacts.filter(c => c.linkPrecedence === 'secondary');

    const emails = [];
    const phoneNumbers = [];

    if (primary.email) emails.push(primary.email);
    if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

    for (const contact of secondaries) {
      if (contact.email && !emails.includes(contact.email)) {
        emails.push(contact.email);
      }
      if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) {
        phoneNumbers.push(contact.phoneNumber);
      }
    }

    return {
      contact: {
        primaryContatctId: primary.id,
        emails,
        phoneNumbers,
        secondaryContactIds: secondaries.map(c => c.id)
      }
    };
  }

  async identifyContact(email, phoneNumber) {
    return await prisma.$transaction(async (tx) => {
      const existingContacts = await this.findExistingContacts(email, phoneNumber);

      if (existingContacts.length === 0) {
        const newContact = await this.createPrimaryContact(email, phoneNumber);
        return this.buildConsolidatedResponse([newContact]);
      }

      const primaryContacts = await this.getAllPrimaryContacts(existingContacts);
      
      const masterPrimary = this.getMasterPrimary(primaryContacts);

      if (primaryContacts.length > 1) {
        await this.mergePrimaryContacts(primaryContacts, masterPrimary);
      }

      const exactContactExists = await this.contactExists(email, phoneNumber, masterPrimary.id);
      
      if (!exactContactExists) {
        await this.createSecondaryContact(email, phoneNumber, masterPrimary.id);
      }

      const allLinkedContacts = await this.getLinkedContacts(masterPrimary.id);
      return this.buildConsolidatedResponse(allLinkedContacts);
    });
  }

  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', database: 'connected' };
    } catch (error) {
      return { status: 'unhealthy', database: 'disconnected', error: error.message };
    }
  }
}

export default new ContactService();
