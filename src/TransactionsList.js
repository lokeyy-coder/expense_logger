import React, { useState } from 'react';

const TransactionsList = ({ isSignedIn, categories }) => {
  const [transactions, setTransactions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [transactionLimit, setTransactionLimit] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editedTransaction, setEditedTransaction] = useState({});
  const [sheetId, setSheetId] = useState(null);

  const transactionLimits = ['5', '10', '15', '20', 'All'];
  const allCategories = ['All', ...categories];

  const fetchTransactions = async () => {
    if (!isSignedIn) {
      setError('Please sign in to view transactions');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
      
      // Get sheet metadata to find the correct sheetId
      const sheetMetadata = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      
      // Find the Tracker_Sheet sheetId
      const trackerSheet = sheetMetadata.result.sheets.find(
        sheet => sheet.properties.title === 'Tracker_Sheet'
      );
      
      if (trackerSheet) {
        setSheetId(trackerSheet.properties.sheetId);
        console.log('Found Tracker_Sheet with sheetId:', trackerSheet.properties.sheetId);
      }

      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Tracker_Sheet!A:D',
      });

      const rows = response.result.values;
      
      if (!rows || rows.length <= 1) {
        setError('No transactions found');
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Skip the header row (first row) and process transactions
      const dataRows = rows.slice(1);
      let processedTransactions = dataRows.map((row, index) => ({
        rowIndex: index + 2, // +2 because: +1 for header row, +1 for 1-based indexing
        date: row[0] || '',
        amount: row[1] || '',
        category: row[2] || '',
        description: row[3] || ''
      }));

      // ALWAYS filter out transactions with description "Initialise" FIRST
      processedTransactions = processedTransactions.filter(
        t => t.description !== 'Initialise'
      );

      // Filter by category
      if (selectedCategory !== 'All') {
        processedTransactions = processedTransactions.filter(
          t => t.category === selectedCategory
        );
      }

      // Sort by most recent (assuming dates are in a sortable format)
      processedTransactions.sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

      // Limit transactions
      if (transactionLimit !== 'All') {
        processedTransactions = processedTransactions.slice(0, parseInt(transactionLimit));
      }

      setTransactions(processedTransactions);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch transactions from Google Sheets');
      setLoading(false);
    }
  };

  const handleEdit = (transaction) => {
    setEditingId(transaction.rowIndex);
    setEditedTransaction({ ...transaction });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedTransaction({});
  };

  const handleSaveEdit = async (transaction) => {
    if (!isSignedIn) {
      setError('Please sign in to edit transactions');
      return;
    }

    try {
      const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
      const range = `Tracker_Sheet!A${transaction.rowIndex}:D${transaction.rowIndex}`;
      
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            editedTransaction.date,
            editedTransaction.amount,
            editedTransaction.category,
            editedTransaction.description
          ]]
        }
      });

      setEditingId(null);
      setEditedTransaction({});
      fetchTransactions(); // Refresh the list
    } catch (err) {
      console.error('Error updating transaction:', err);
      setError('Failed to update transaction');
    }
  };

  const handleDelete = async (transaction) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    if (!isSignedIn) {
      setError('Please sign in to delete transactions');
      return;
    }

    if (sheetId === null) {
      setError('Sheet ID not found. Please reload transactions first.');
      return;
    }

    setLoading(true);

    try {
      const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
      
      console.log('Deleting row:', transaction.rowIndex, 'from sheetId:', sheetId);
      
      // Delete the row using batchUpdate
      const response = await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: transaction.rowIndex - 1, // 0-indexed
                endIndex: transaction.rowIndex // Exclusive
              }
            }
          }]
        }
      });

      console.log('Delete response:', response);
      
      setLoading(false);
      fetchTransactions(); // Refresh the list
    } catch (err) {
      console.error('Error deleting transaction:', err);
      console.error('Error details:', err.result);
      setError(`Failed to delete transaction: ${err.result?.error?.message || err.message}`);
      setLoading(false);
    }
  };

  const handleEditChange = (field, value) => {
    setEditedTransaction(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="transactions-list-container">
      <h2 className="transactions-title">PREVIOUS TRANSACTIONS LIST</h2>
      
      <div className="transactions-controls">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="transaction-category-select">CATEGORY:</label>
            <select
              id="transaction-category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-dropdown"
            >
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="transaction-limit-select">LIMIT:</label>
            <select
              id="transaction-limit-select"
              value={transactionLimit}
              onChange={(e) => setTransactionLimit(e.target.value)}
              className="filter-dropdown"
            >
              {transactionLimits.map(limit => (
                <option key={limit} value={limit}>{limit}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button 
          onClick={fetchTransactions}
          disabled={loading || !isSignedIn}
          className="refresh-button"
        >
          {loading ? 'LOADING...' : 'LOAD TRANSACTIONS'}
        </button>
      </div>

      {error && (
        <div className="chart-error">
          {error}
        </div>
      )}

      {transactions.length > 0 && !error && (
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.rowIndex}>
                  {editingId === transaction.rowIndex ? (
                    <>
                      <td>
                        <input
                          type="date"
                          value={editedTransaction.date}
                          onChange={(e) => handleEditChange('date', e.target.value)}
                          className="edit-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editedTransaction.amount}
                          onChange={(e) => handleEditChange('amount', e.target.value)}
                          step="0.01"
                          className="edit-input"
                        />
                      </td>
                      <td>
                        <select
                          value={editedTransaction.category}
                          onChange={(e) => handleEditChange('category', e.target.value)}
                          className="edit-select"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editedTransaction.description}
                          onChange={(e) => handleEditChange('description', e.target.value)}
                          className="edit-input"
                        />
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleSaveEdit(transaction)}
                            className="action-btn save-btn"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="action-btn cancel-btn"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{transaction.date}</td>
                      <td>${parseFloat(transaction.amount).toFixed(2)}</td>
                      <td>{transaction.category}</td>
                      <td>{transaction.description}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="action-btn edit-btn"
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(transaction)}
                            className="action-btn delete-btn"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transactions.length === 0 && !error && !loading && (
        <div className="chart-placeholder">
          Click "LOAD TRANSACTIONS" to view your previous expenses
        </div>
      )}
    </div>
  );
};

export default TransactionsList;
