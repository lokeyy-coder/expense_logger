import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, Tag, FileText } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Expense Logger</h1>
          <p className="text-gray-600">Track your spending effortlessly</p>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-fadeIn">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-800 font-medium">Expense logged successfully!</span>
          </div>
        )}

        {/* Sign In Prompt */}
        {!isSignedIn && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 font-medium">Please sign in to continue</span>
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Field */}
            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Date
              </label>
              <input 
                type="date" 
                id="date"
                name="date" 
                value={expense.date} 
                onChange={handleChange} 
                className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.date ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                }`} 
              />
              {errors.date && <p className="text-red-500 text-xs mt-2 ml-1">{errors.date}</p>}
            </div>
            
            {/* Amount Field */}
            <div>
              <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-500" />
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-500 font-medium">$</span>
                <input 
                  type="number" 
                  id="amount"
                  name="amount" 
                  value={expense.amount} 
                  onChange={handleChange} 
                  placeholder="0.00"
                  step="0.01"
                  className={`w-full pl-8 pr-4 py-3 border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.amount ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`} 
                />
              </div>
              {errors.amount && <p className="text-red-500 text-xs mt-2 ml-1">{errors.amount}</p>}
            </div>
            
            {/* Category Field */}
            <div>
              <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" />
                Category
              </label>
              <select 
                id="category"
                name="category"
                value={expense.category} 
                onChange={handleChange} 
                className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white ${
                  errors.category ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1rem center',
                  backgroundSize: '1.25rem'
                }}
              >
                <option value="">Select a category</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-2 ml-1">{errors.category}</p>}
            </div>
            
            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea 
                id="description"
                name="description" 
                value={expense.description} 
                onChange={handleChange} 
                placeholder="Add any additional details..."
                rows="3"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-300 resize-none"
              ></textarea>
            </div>
            
            {/* Submit Button */}
            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {isSignedIn ? 'Log Expense' : 'Sign in with Google'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Securely synced with Google Sheets
        </p>
      </div>
    </div>
  );
};

export default ExpenseLogger;