import React, { useState, useEffect } from 'react';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

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
  const [tokenClient, setTokenClient] = useState(null);

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

  useEffect(() => {
    // Load the Google API client and Identity Services script
    const loadGoogleScripts = () => {
      const gsiScript = document.createElement('script');
      gsiScript.src = 'https://accounts.google.com/gsi/client';
      gsiScript.async = true;
      gsiScript.defer = true;
      document.body.appendChild(gsiScript);

      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.async = true;
      gapiScript.defer = true;
      gapiScript.onload = initializeGapiClient;
      document.body.appendChild(gapiScript);
    };

    loadGoogleScripts();
  }, []);

  const initializeGapiClient = async () => {
    try {
      await new Promise((resolve, reject) => {
        window.gapi.load('client', { callback: resolve, onerror: reject });
      });
      
      await window.gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
      
      console.log('GAPI client initialized');
      
      // Now initialize the Google Identity Services client
      if (window.google && window.google.accounts) {
        initializeGoogleIdentityServices();
      } else {
        // If Google Identity Services isn't loaded yet, wait for it
        const checkGsiLoaded = setInterval(() => {
          if (window.google && window.google.accounts) {
            clearInterval(checkGsiLoaded);
            initializeGoogleIdentityServices();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error initializing GAPI client:', error);
    }
  };

  const initializeGoogleIdentityServices = () => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: handleTokenResponse,
    });
    
    setTokenClient(client);
    console.log('Google Identity Services initialized');
  };

  const handleTokenResponse = (response) => {
    if (response && response.access_token) {
      setIsSignedIn(true);
      console.log('Successfully signed in');
    } else {
      setIsSignedIn(false);
      console.error('Error during sign in', response);
    }
  };

  const handleAuthClick = () => {
    if (!isSignedIn && tokenClient) {
      // Request an access token
      tokenClient.requestAccessToken();
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
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
          <input 
            type="date" 
            id="date"
            name="date" 
            value={expense.date} 
            onChange={handleChange} 
            className={`w-full p-2 border rounded ${errors.date ? 'border-red-500' : 'border-gray-300'}`} 
          />
          {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
        </div>
        
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
          <input 
            type="number" 
            id="amount"
            name="amount" 
            value={expense.amount} 
            onChange={handleChange} 
            placeholder="0.00"
            className={`w-full p-2 border rounded ${errors.amount ? 'border-red-500' : 'border-gray-300'}`} 
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>
        
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
          <select 
            id="category"
            name="category" 
            value={expense.category} 
            onChange={handleChange} 
            className={`w-full p-2 border rounded ${errors.category ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">Select a category</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea 
            id="description"
            name="description" 
            value={expense.description} 
            onChange={handleChange} 
            placeholder="Enter expense details"
            className="w-full p-2 border border-gray-300 rounded"
          ></textarea>
        </div>
        
        <button 
          type="submit" 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded transition duration-200"
        >
          {isSignedIn ? 'Log Expense' : 'Sign in with Google'}
        </button>
      </form>
    </div>
  );
};

export default ExpenseLogger;