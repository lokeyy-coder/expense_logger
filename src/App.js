import React from 'react';
import ExpenseLogger from './ExpenseLogger'; // Adjust the path if ExpenseLogger.js is in a different folder

const App = () => {
  return (
    <div className="App">
      <header className="bg-blue-500 text-white py-4 text-center">
        <h1 className="text-2xl font-bold">Expense Tracker</h1>
      </header>
      <main className="p-4">
        <ExpenseLogger />
      </main>
    </div>
  );
};

export default App;
