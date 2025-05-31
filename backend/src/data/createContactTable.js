import pool from "../config/db.js";

const createContactTable = async () => {
  const queryText = `CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    linked_id INTEGER REFERENCES contacts(id),
    link_precedence VARCHAR(10) CHECK (link_precedence IN ('primary', 'secondary')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);`;

  try {
    pool.query(queryText);
    console.log('Contact table created, didnt exist before!');
  } catch(error) {
    console.log('Error creating contact table!: ', error);
  }
};

export default createContactTable;
