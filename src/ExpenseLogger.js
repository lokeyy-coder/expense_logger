import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const SCOPES = process.env.REACT_APP_SCOPES;

// const CLIENT_ID = '539348670655-f2a4fnq8dmjfuhru2eqsvv36c1r4i0k7.apps.googleusercontent.com'; // Replace with your Google Client ID
// const API_KEY = 'AIzaSyAeWD5uO4_5hDkm8fROSUURPXMGfgnPC1Q'; // Replace with your Google API key
// const SPREADSHEET_ID = '1CcbLwXHU9A7TaPdJh3DX9f3R_xhLshhraNeT_wkajYU'; // Replace with your Google Sheets ID
// const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

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
    'Wellbeing allowance - Andrew',
    'Wellbeing allowance - Emmy',
    'Utilities (Water, Gas & Elec)',
    'Gift Allowance',
    'Car expenses',
    'Others'
  ];

  useEffect(() => {
    // Load the Google API client library
    const loadGoogleAPI = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = initializeGoogleAPI;
      document.body.appendChild(script);
    };

    loadGoogleAPI();
  }, []);

  const initializeGoogleAPI = () => {
    window.gapi.load('client:auth2', async () => {
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          plugin_name: 'expense_tracker'
        });
  
        // Ensure that the Google Sheets API is loaded
        await window.gapi.client.load('sheets', 'v4');  // This ensures the Sheets API is loaded
  
        // Listen for sign-in state changes
        window.gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        // Handle the initial sign-in state
        updateSigninStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
        console.log('Google API initialized and Sheets API loaded');
      } catch (error) {
        console.error('Error initializing Google API or Sheets API:', error);
      }
    });
  };

  const updateSigninStatus = (isSignedIn) => {
    console.log('Sign-in status updated:', isSignedIn); // Log sign-in status
    setIsSignedIn(isSignedIn);
  };

  const handleAuthClick = () => {
    if (!isSignedIn) {
      window.gapi.auth2.getAuthInstance().signIn();
    }
  };

  const appendToSheet = async (values) => {
    console.log('Trying to append to Google Sheets:', values); // Log the values being appended
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Tracker_Sheet!A:D', // Adjust to target the correct range in your sheet
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            values.date,
            values.amount,
            values.category,
            values.description
          ]]
        }
      });
      console.log('Response from Google Sheets:', response); // Log the response from the API
      return response.status === 200;
    } catch (error) {
      console.error('Error appending to sheet:', error); // Log any errors during the API call
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
    console.log('Submitting form with values:', expense); // Log the values before submitting

    if (Object.keys(newErrors).length === 0) {
      if (!isSignedIn) {
        console.log('User not signed in. Triggering Google sign-in'); // Log when sign-in is required
        handleAuthClick();
        return;
      }

      const success = await appendToSheet(expense);
      
      if (success) {
        console.log('Expense logged successfully'); // Log success
        setShowSuccess(true);
        setExpense({
          date: '',
          amount: '',
          category: '',
          description: ''
        });
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        console.log('Failed to log expense'); // Log if appending failed
      }
    } else {
      console.log('Validation errors:', newErrors); // Log validation errors
      setErrors(newErrors);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Updating ${name} to ${value}`); // Log which field is being updated
    setExpense(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-bold text-center">Log Expense</h2>
      
      {/* Success Message */}
      {showSuccess && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 border-l-4 border-green-500">
          <p>Expense logged successfully!</p>
        </div>
      )}

      {/* Google Sign-In Status */}
      {!isSignedIn && (
        <div className="mb-4 p-4 bg-blue-100 text-blue-700 border-l-4 border-blue-500">
          <p>Please sign in with Google to log expenses</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            name="date"
            value={expense.date}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {errors.date && (
            <p className="text-red-500 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.date}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="number"
            name="amount"
            value={expense.amount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {errors.amount && (
            <p className="text-red-500 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.amount}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            name="category"
            value={expense.category}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Select a category</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="text-red-500 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.category}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={expense.description}
            onChange={handleChange}
            placeholder="Add details about the expense..."
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            rows="3"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
        >
          {isSignedIn ? 'Log Expense' : 'Sign in with Google'}
        </button>
      </form>
    </div>
  );
};

export default ExpenseLogger;
