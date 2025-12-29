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
    'Dating Allowance',
    'Petrol',
    'Gift Allowance',
    'Wellbeing allowance - Andrew',
    'Wellbeing allowance - Emmy',
    'Wellbeing allowance - Together',
    'Car Expenses',
    'Utilities (Water, Gas & Elec)',
    'Groceries',
    'Food & Dining',
    'Household Goods (e.g. Medicine, Cleaning, Small goods)',
    'Others'
  ];

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      if (window.google && window.google.accounts) {
        initializeGoogleIdentityServices();
      } else {
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
    <div className="expense-logger-container">
      <div className="expense-logger-content">
        {/* Header */}
        <div className="header">
          <h1>EXPENSE LOGGER</h1>
          <p className="subtitle">Track your spending with ease</p>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="message success-message">
            ✓ Expense logged successfully!
          </div>
        )}

        {/* Sign In Prompt */}
        {!isSignedIn && (
          <div className="message info-message">
            Please sign in with Google to continue
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="expense-form">
          <div className="form-group">
            <input 
              type="date" 
              id="date"
              name="date" 
              value={expense.date} 
              onChange={handleChange}
              placeholder="* DATE"
              className={errors.date ? 'error' : ''}
            />
            {errors.date && <span className="error-text">{errors.date}</span>}
          </div>

          <div className="form-group">
            <input 
              type="number" 
              id="amount"
              name="amount" 
              value={expense.amount} 
              onChange={handleChange} 
              placeholder="* AMOUNT"
              step="0.01"
              className={errors.amount ? 'error' : ''}
            />
            {errors.amount && <span className="error-text">{errors.amount}</span>}
          </div>

          <div className="form-group">
            <select 
              id="category"
              name="category"
              value={expense.category} 
              onChange={handleChange}
              className={errors.category ? 'error' : ''}
            >
              <option value="">* CATEGORY</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            {errors.category && <span className="error-text">{errors.category}</span>}
          </div>

          <div className="form-group">
            <textarea 
              id="description"
              name="description" 
              value={expense.description} 
              onChange={handleChange} 
              placeholder="DESCRIPTION (OPTIONAL)"
              rows="4"
            ></textarea>
          </div>

          <button type="submit" className="submit-button">
            {isSignedIn ? 'SUBMIT' : 'SIGN IN WITH GOOGLE'}
          </button>
        </form>

        <p className="footer-text">* Required Fields</p>
      </div>
    </div>
  );
};

export default ExpenseLogger;
