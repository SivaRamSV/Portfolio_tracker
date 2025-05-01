const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5001;

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3005', 'http://localhost:3002', 'http://localhost:3000'],
}));
app.options('*', cors());
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Initialize SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'portfolio.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    
    // Create v2 table with month and year tracking
    db.run(`CREATE TABLE IF NOT EXISTS portfolio_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_name TEXT NOT NULL,
      asset_value REAL NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Table portfolio_v2 created or already exists');
        
        // Check if we need to migrate data from the old table
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='portfolio'", (err, table) => {
          if (!err && table) {
            // Check if we already migrated the data
            db.get("SELECT COUNT(*) as count FROM portfolio_v2", (err, result) => {
              if (!err && result.count === 0) {
                console.log("Migrating data from portfolio to portfolio_v2...");
                // Migrate data from old table, extracting month and year from created_at
                db.all("SELECT * FROM portfolio", [], (err, rows) => {
                  if (!err && rows.length > 0) {
                    const migrationStmt = db.prepare(`
                      INSERT INTO portfolio_v2 (asset_name, asset_value, month, year, created_at)
                      VALUES (?, ?, ?, ?, ?)
                    `);
                    
                    rows.forEach(row => {
                      const date = new Date(row.created_at);
                      const month = date.getMonth(); // 0-11
                      const year = date.getFullYear();
                      
                      migrationStmt.run([
                        row.asset_name,
                        row.asset_value,
                        month,
                        year,
                        row.created_at
                      ], (err) => {
                        if (err) console.error('Error migrating data:', err.message);
                      });
                    });
                    
                    migrationStmt.finalize();
                    console.log(`Migrated ${rows.length} assets to the new schema`);
                  }
                });
              }
            });
          }
        });
      }
    });
  }
});

// Routes
// Add a new asset with month and year
app.post('/portfolio', (req, res) => {
  console.log('Received request body:', req.body);
  const { asset_name, asset_value, month, year } = req.body;
  
  if (!asset_name || !asset_value) {
    console.error('Validation failed: Missing asset_name or asset_value');
    return res.status(400).json({ error: 'Asset name and value are required.' });
  }
  
  // Use current date's month and year if not specified
  const currentDate = new Date();
  let assetMonth = month !== undefined ? month : currentDate.getMonth();
  const assetYear = year !== undefined ? year : currentDate.getFullYear();

  // Validate month is between 0-11 (Jan-Dec)
  if (assetMonth < 0 || assetMonth > 12) {
    console.warn(`Invalid month value received: ${assetMonth}, normalizing to valid range`);
    // Normalize the month value to be within 0-11
    assetMonth = assetMonth % 12;
    if (assetMonth < 0) assetMonth += 12; // Handle negative values
  }

  const query = `INSERT INTO portfolio_v2 (asset_name, asset_value, month, year) VALUES (?, ?, ?, ?)`;
  db.run(query, [asset_name, asset_value, assetMonth, assetYear], function (err) {
    if (err) {
      console.error('Error inserting data:', err.message);
      return res.status(500).json({ error: 'Failed to add asset.' });
    }
    console.log('Asset added successfully with ID:', this.lastID);
    res.status(201).json({ 
      id: this.lastID, 
      asset_name, 
      asset_value,
      month: assetMonth,
      year: assetYear
    });
  });
});

// Get assets filtered by month and year if specified
app.get('/portfolio', (req, res) => {
  const { month, year } = req.query;
  let query = `SELECT * FROM portfolio_v2`;
  let params = [];
  
  // Filter by month and year if provided
  if (month !== undefined && year !== undefined) {
    query += ` WHERE month = ? AND year = ?`;
    params = [month, year];
  } else if (month !== undefined) {
    query += ` WHERE month = ?`;
    params = [month];
  } else if (year !== undefined) {
    query += ` WHERE year = ?`;
    params = [year];
  }
  
  query += ` ORDER BY asset_name`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching data:', err.message);
      return res.status(500).json({ error: 'Failed to fetch portfolio.' });
    }
    
    // Normalize month values to be within 0-11 range
    const normalizedRows = rows.map(row => {
      if (row.month < 0 || row.month > 12) {
        console.warn(`Normalizing invalid month value in results: ${row.month}`);
        const normalizedMonth = row.month % 12;
        return {
          ...row,
          month: normalizedMonth < 0 ? normalizedMonth + 12 : normalizedMonth
        };
      }
      return row;
    });
    
    res.status(200).json(normalizedRows);
  });
});

// Get available months with data
app.get('/portfolio/months', (req, res) => {
  const query = `SELECT DISTINCT month, year FROM portfolio_v2 ORDER BY year DESC, month DESC`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching months:', err.message);
      return res.status(500).json({ error: 'Failed to fetch available months.' });
    }
    // Normalize month values to be within 0-11 range
    const normalizedRows = rows.map(row => {
      if (row.month < 0 || row.month > 12) {
        console.warn(`Normalizing invalid month value in months endpoint: ${row.month}`);
        const normalizedMonth = row.month % 12;
        return {
          ...row,
          month: normalizedMonth < 0 ? normalizedMonth + 12 : normalizedMonth
        };
      }
      return row;
    });
    res.status(200).json(normalizedRows);
  });
});

// Get available years with data
app.get('/portfolio/years', (req, res) => {
  const query = `SELECT DISTINCT year FROM portfolio_v2 ORDER BY year DESC`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching years:', err.message);
      return res.status(500).json({ error: 'Failed to fetch available years.' });
    }
    res.status(200).json(rows.map(row => row.year)); // Return just the year values in an array
  });
});

// Get monthly performance data for a specific year
app.get('/portfolio/performance/:year', (req, res) => {
  const year = parseInt(req.params.year);
  
  if (isNaN(year)) {
    return res.status(400).json({ error: 'Invalid year parameter' });
  }
  
  const query = `
    SELECT month, SUM(asset_value) as total_value 
    FROM portfolio_v2 
    WHERE year = ? 
    GROUP BY month 
    ORDER BY month
  `;
  
  db.all(query, [year], (err, rows) => {
    if (err) {
      console.error('Error fetching performance data:', err.message);
      return res.status(500).json({ error: 'Failed to fetch performance data.' });
    }
    
    // Create an array with 12 months (0-11), with null values for months without data
    const monthlyData = Array(13).fill(null);
    // Fill in the data we have
    rows.forEach(row => {
      if (row.month >=1 && row.month <=12) {
        monthlyData[row.month] = row.total_value;
      }
    });
    monthlyData.shift()
    res.status(200).json(monthlyData);
  });
});

// Update an asset
app.put('/portfolio/:id', (req, res) => {
  const { id } = req.params;
  const { asset_name, asset_value, month, year } = req.body;
  const updateFields = [];
  const params = [];
  
  if (asset_name) {
    updateFields.push('asset_name = ?');
    params.push(asset_name);
  }
  
  if (asset_value !== undefined) {
    updateFields.push('asset_value = ?');
    params.push(asset_value);
  }
  
  // Validate month is within valid range (0-11)
  let validMonth = month;
  if (month !== undefined) {
    if (month < 0 || month > 12) {
      console.warn(`Invalid month value received in update: ${month}, normalizing to valid range`);
      validMonth = month % 12;
      if (validMonth < 0) validMonth += 12; // Handle negative values
    }
    updateFields.push('month = ?');
    params.push(validMonth);
  }
  
  if (year !== undefined) {
    updateFields.push('year = ?');
    params.push(year);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update.' });
  }
  
  // Add updated_at
  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  
  // Add id parameter at the end
  params.push(id);
  
  const query = `UPDATE portfolio_v2 SET ${updateFields.join(', ')} WHERE id = ?`;
  
  db.run(query, params, function (err) {
    if (err) {
      console.error('Error updating asset:', err.message);
      return res.status(500).json({ error: 'Failed to update asset.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    
    // Fetch the updated record to return
    db.get(`SELECT * FROM portfolio_v2 WHERE id = ?`, [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve updated asset.' });
      }
      res.status(200).json(row);
    });
  });
});

// Delete an asset
app.delete('/portfolio/:id', (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM portfolio_v2 WHERE id = ?`;
  db.run(query, [id], function (err) {
    if (err) {
      console.error('Error deleting asset:', err.message);
      return res.status(500).json({ error: 'Failed to delete asset.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    res.status(200).json({ message: 'Asset deleted successfully.' });
  });
});

// Fix invalid month values in the database
app.post('/portfolio/fix-months', (req, res) => {
  console.log('Starting database month value fix...');
  
  // First, identify records with invalid month values
  const query = `SELECT id, month FROM portfolio_v2 WHERE month < 0 OR month > 11`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error identifying invalid month values:', err.message);
      return res.status(500).json({ error: 'Failed to identify invalid month values.' });
    }
    
    if (rows.length === 0) {
      return res.status(200).json({ message: 'No invalid month values found.' });
    }
    
    console.log(`Found ${rows.length} records with invalid month values`);
    let fixedCount = 0;
    
    // Prepare update statement
    const updateStmt = db.prepare(`UPDATE portfolio_v2 SET month = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    
    // Process each invalid record
    for (const row of rows) {
      // Normalize the month value
      let normalizedMonth = row.month % 12;
      if (normalizedMonth < 0) normalizedMonth += 12;
      
      console.log(`Fixing record ID ${row.id}: month ${row.month} -> ${normalizedMonth}`);
      
      // Use run with a promise wrapper for sequential execution
      updateStmt.run([normalizedMonth, row.id], function(err) {
        if (err) {
          console.error(`Error fixing record ID ${row.id}:`, err.message);
        } else if (this.changes > 0) {
          fixedCount++;
        }
      });
    }
    
    updateStmt.finalize(() => {
      console.log(`Fixed ${fixedCount} records with invalid month values`);
      res.status(200).json({ 
        message: `Fixed ${fixedCount} records with invalid month values.`,
        found: rows.length,
        fixed: fixedCount 
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});