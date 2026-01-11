import React, { useState, useEffect } from 'react';

const WeeklyInsights = ({ isSignedIn }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);

  // Calculate current week number
  useEffect(() => {
    const now = new Date();
    const weekNum = getWeekNumber(now);
    setCurrentWeek(weekNum);
  }, []);

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const fetchInsights = async () => {
    if (!isSignedIn) {
      setError('Please sign in to view insights');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Configured_Input!A:O',
      });

      const rows = response.result.values;
      
      if (!rows || rows.length <= 1) {
        setError('No data found');
        setLoading(false);
        return;
      }

      const processedInsights = processWeeklyScorecard(rows, currentWeek);
      setInsights(processedInsights);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError('Failed to fetch insights from Google Sheets');
      setLoading(false);
    }
  };

  const processWeeklyScorecard = (rows, weekNum) => {
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    const weekNumIndex = headers.findIndex(h => h === 'WeekNum');
    const amountIndex = headers.findIndex(h => h === 'Amount');
    const categoryIndex = headers.findIndex(h => h === 'Category');
    const weeklyBudgetIndex = headers.findIndex(h => h === 'Weekly Budget');
    const descriptionIndex = headers.findIndex(h => h === 'Description');
    
    if (weekNumIndex === -1 || amountIndex === -1 || categoryIndex === -1) {
      return null;
    }

    // Group spending by week and category
    const spendingByWeekCategory = {};
    const budgets = {};
    
    dataRows.forEach(row => {
      const rowWeekNum = row[weekNumIndex];
      const amount = parseFloat(row[amountIndex]) || 0;
      const category = row[categoryIndex];
      const description = row[descriptionIndex] || '';
      const budget = parseFloat(row[weeklyBudgetIndex]) || 0;
      
      if (!rowWeekNum || !category) return;
      
      // Extract week number (handle formats like "2025-W01" or "1")
      const weekNumOnly = rowWeekNum.toString().match(/\d+$/)?.[0];
      if (!weekNumOnly) return;
      
      const weekNumInt = parseInt(weekNumOnly);
      const key = `${weekNumInt}-${category}`;
      
      // Store budgets from "Initialise" rows
      if (description.toLowerCase() === 'initialise') {
        budgets[category] = budget;
        return;
      }
      
      // Accumulate spending
      if (!spendingByWeekCategory[key]) {
        spendingByWeekCategory[key] = 0;
      }
      spendingByWeekCategory[key] += amount;
    });

    // Get unique categories that have budgets
    const categoriesWithBudgets = Object.keys(budgets);
    
    // Calculate this week and last week totals
    let totalThisWeek = 0;
    let totalLastWeek = 0;
    let totalBudget = 0;
    let categoriesOnTrack = 0;
    
    // Build category details for bar charts
    const categoryDetails = [];
    
    categoriesWithBudgets.forEach(category => {
      const thisWeekKey = `${weekNum}-${category}`;
      const lastWeekKey = `${weekNum - 1}-${category}`;
      
      const thisWeek = spendingByWeekCategory[thisWeekKey] || 0;
      const lastWeek = spendingByWeekCategory[lastWeekKey] || 0;
      const budget = budgets[category] || 0;
      
      totalThisWeek += thisWeek;
      totalLastWeek += lastWeek;
      totalBudget += budget;
      
      // Check if category is on track (under or equal to budget)
      if (budget > 0 && thisWeek <= budget) {
        categoriesOnTrack++;
      }
      
      // Only include categories with budgets > 0
      if (budget > 0) {
        categoryDetails.push({
          category,
          spent: thisWeek,
          budget,
          percentUsed: (thisWeek / budget) * 100
        });
      }
    });
    
    // Sort categories by percent used (descending) so over-budget items appear first
    categoryDetails.sort((a, b) => b.percentUsed - a.percentUsed);
    
    const totalDifference = totalThisWeek - totalLastWeek;
    const totalPercentChange = totalLastWeek > 0 ? (totalDifference / totalLastWeek) * 100 : 0;
    const totalCategories = categoriesWithBudgets.length;

    return {
      weekNum,
      totalThisWeek,
      totalLastWeek,
      totalBudget,
      totalDifference,
      totalPercentChange,
      categoriesOnTrack,
      totalCategories,
      categoryDetails
    };
  };

  return (
    <div className="weekly-insights-container">
      <h2 className="insights-title">WEEK {currentWeek} SPENDING SCORECARD</h2>
      
      <button 
        onClick={fetchInsights}
        disabled={loading || !isSignedIn}
        className="refresh-button"
        style={{ marginBottom: '30px' }}
      >
        {loading ? 'LOADING...' : 'LOAD SCORECARD'}
      </button>

      {error && <div className="chart-error">{error}</div>}

      {insights && !error && (
        <>
          {/* Top Scorecard - 3 metrics */}
          <div className="scorecard">
            <div className="scorecard-row">
              <div className="scorecard-item">
                <span className="scorecard-label">Total Spent</span>
                <span className="scorecard-value">
                  ${insights.totalThisWeek.toFixed(2)}
                </span>
                <span className="scorecard-subtext">
                  of ${insights.totalBudget.toFixed(2)} budget
                </span>
                <span className="scorecard-percentage">
                  ({((insights.totalThisWeek / insights.totalBudget) * 100).toFixed(0)}%)
                </span>
              </div>
              
              <div className="scorecard-item">
                <span className="scorecard-label">vs Last Week</span>
                <span className={`scorecard-value ${insights.totalDifference > 0 ? 'negative' : 'positive'}`}>
                  {insights.totalDifference > 0 ? '+' : ''}${insights.totalDifference.toFixed(2)}
                </span>
                <span className="scorecard-subtext">
                  {insights.totalPercentChange > 0 ? '+' : ''}{insights.totalPercentChange.toFixed(1)}% change
                </span>
                <span className="scorecard-icon">
                  {insights.totalDifference > 0 ? '↑' : insights.totalDifference < 0 ? '↓' : '→'}
                </span>
              </div>
              
              <div className="scorecard-item">
                <span className="scorecard-label">Categories On Track</span>
                <span className="scorecard-value">
                  {insights.categoriesOnTrack} / {insights.totalCategories}
                </span>
                <span className="scorecard-subtext">
                  categories under budget
                </span>
                <span className={`scorecard-status ${insights.totalBudget >= insights.totalThisWeek ? 'success' : 'warning'}`}>
                  {insights.totalBudget >= insights.totalThisWeek ? '✓ On Track' : '⚠️ Over Budget'}
                </span>
              </div>
            </div>
          </div>

          {/* Category Bar Charts */}
          <div className="category-bars-container">
            <h3 className="category-bars-title">BUDGET USAGE BY CATEGORY</h3>
            <div className="category-bars-list">
              {insights.categoryDetails.map((category, index) => {
                const percentUsed = Math.min(category.percentUsed, 150); // Cap display at 150%
                const isOverBudget = category.percentUsed > 100;
                const isNearBudget = category.percentUsed > 80 && category.percentUsed <= 100;
                
                return (
                  <div key={index} className="category-bar-item">
                    <div className="category-bar-header">
                      <span className="category-bar-name">{category.category}</span>
                      <span className="category-bar-amounts">
                        ${category.spent.toFixed(2)} / ${category.budget.toFixed(2)}
                      </span>
                    </div>
                    <div className="category-bar-wrapper">
                      <div className="category-bar-track">
                        <div 
                          className={`category-bar-fill ${isOverBudget ? 'over-budget' : isNearBudget ? 'near-budget' : 'good'}`}
                          style={{ width: `${percentUsed}%` }}
                        >
                          <span className="category-bar-percent">
                            {category.percentUsed.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!insights && !error && !loading && (
        <div className="chart-placeholder">
          Click "LOAD SCORECARD" to view your weekly spending summary
        </div>
      )}
    </div>
  );
};

export default WeeklyInsights;
