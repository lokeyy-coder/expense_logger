import React, { useState, useEffect, useCallback } from 'react';
// import { AlertCircle } from 'lucide-react';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const SCOPES = process.env.REACT_APP_SCOPES;

const ExpenseLogger = () => {
  const [expense, setExpense] = useState({
    date: '',
    amount: '',
    category: '',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const categories = [
    'Food & Dining',
    'Groceries',
    'Petrol',
    'Dating Allowance',
    'Wellbeing Allowance - Andrew',
    'Wellbeing Allowance - Emmy',
    'Utilities (Water, Gas & Elec)',
    'Gift Allowance',
    'Car Expenses',
    'Others'
  ];

  const initializeGoogleAPI = useCallback(() => {
    window.gapi.load('client:auth2', async () => {
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES
        });
        
        await window.gapi.client.load('sheets', 'v4');
        
        const authInstance = window.gapi.auth2.getAuthInstance();
        authInstance.isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(authInstance.isSignedIn.get());
        console.log('Google API initialized and Sheets API loaded');
      } catch (error) {
        console.error('Error initializing Google API or Sheets API:', error);
      }
    });
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = initializeGoogleAPI;
    document.body.appendChild(script);
  }, [initializeGoogleAPI]);

  const updateSigninStatus = (status) => {
    console.log('Sign-in status updated:', status);
    setIsSignedIn(status);
  };

  const handleAuthClick = () => {
    if (!isSignedIn) {
      window.gapi.auth2.getAuthInstance().signIn();
    }
  };

  const appendToSheet = async (values) => {
    console.log('Appending to Google Sheets:', values);
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Tracker_Sheet!A:D',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[values.date, values.amount, values.category, values.description]]
        }
      });
      console.log('Response from Google Sheets:', response);
      return response.status === 200;
    } catch (error) {
      console.error('Error appending to sheet:', error);
      return false;
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!expense.date) newErrors.date = 'Date is required';
    if (!expense.amount || expense.amount <= 0) newErrors.amount = 'Valid amount is required';
    if (!expense.category) newErrors.category = 'Category is required';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length === 0) {
      if (!isSignedIn) {
        handleAuthClick();
        return;
      }

      const success = await appendToSheet(expense);
      if (success) {
        setShowSuccess(true);
        setExpense({ date: '', amount: '', category: '', description: '' });
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } else {
      setErrors(newErrors);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setExpense(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-bold text-center">Log Expense</h2>
      {showSuccess && <div className="mb-4 p-4 bg-green-100 text-green-700">Expense logged successfully!</div>}
      {!isSignedIn && <div className="mb-4 p-4 bg-blue-100 text-blue-700">Please sign in with Google</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="date" name="date" value={expense.date} onChange={handleChange} className="w-full p-2 border rounded" />
        <input type="number" name="amount" value={expense.amount} onChange={handleChange} className="w-full p-2 border rounded" />
        <select name="category" value={expense.category} onChange={handleChange} className="w-full p-2 border rounded">
          <option value="">Select a category</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <textarea name="description" value={expense.description} onChange={handleChange} className="w-full p-2 border rounded"></textarea>
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">{isSignedIn ? 'Log Expense' : 'Sign in with Google'}</button>
      </form>
    </div>
  );
};

export default ExpenseLogger;
