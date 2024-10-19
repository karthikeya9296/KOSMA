import React, { useState, useEffect } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import { ethers } from "ethers";
import Chart from "chart.js/auto";
import 'tailwindcss/tailwind.css';

const RoyaltyDashboard = () => {
  const [earnings, setEarnings] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [currency, setCurrency] = useState('ETH');
  const [conversionRate, setConversionRate] = useState(1);

  // Fetch earnings and transaction history
  const fetchData = async () => {
    try {
      setLoading(true);
      const [earningsResponse, historyResponse] = await Promise.all([
        axios.get("/api/royalty/earnings"),
        axios.get("/api/royalty/history")
      ]);
      setEarnings(earningsResponse.data);
      setTransactionHistory(historyResponse.data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load data");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch conversion rate when currency changes
  useEffect(() => {
    const fetchConversionRate = async () => {
      if (currency !== "ETH") {
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/ETH`);
        setConversionRate(response.data.rates[currency]);
      }
    };
    fetchConversionRate();
  }, [currency]);

  // Handle withdrawal of earnings
  const handleWithdraw = async () => {
    if (!window.ethereum) {
      setWithdrawalStatus("Please install MetaMask to withdraw earnings.");
      return;
    }
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract('contractAddress', 'ABI', signer);
      await contract.withdraw(ethers.utils.parseEther(withdrawalAmount));
      setWithdrawalStatus("Withdrawal successful!");
      fetchData(); // Refresh data after withdrawal
    } catch (error) {
      console.error("Error withdrawing:", error);
      setWithdrawalStatus("Withdrawal failed. Please try again.");
    }
  };

  // Prepare data for the chart
  const chartData = React.useMemo(() => ({
    labels: earnings.map(earning => new Date(earning.date).toLocaleDateString()),
    datasets: [
      {
        label: "Earnings Over Time",
        data: earnings.map(earning => earning.amount * conversionRate),
        fill: false,
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.1,
      },
    ],
  }), [earnings, conversionRate]);

  // Handle pagination
  const displayedTransactions = transactionHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center">
        <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-blue-600" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Royalty Dashboard</h1>
      <div className="total-earnings mb-4">
        <h2 className="text-xl">Total Earnings: {(earnings.reduce((acc, curr) => acc + curr.amount, 0) * conversionRate).toFixed(2)} {currency}</h2>
        <select onChange={(e) => setCurrency(e.target.value)} value={currency} className="mt-2">
          <option value="ETH">ETH</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <Line data={chartData} />
      <div className="withdrawal-section my-4">
        <input
          type="number"
          placeholder="Enter amount to withdraw"
          onChange={(e) => setWithdrawalAmount(e.target.value)}
          value={withdrawalAmount}
          className="border px-2 py-1 mr-2"
        />
        <button
          onClick={handleWithdraw}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Withdraw Earnings
        </button>
        {withdrawalStatus && <p className="mt-2 text-blue-600">{withdrawalStatus}</p>}
      </div>
      <h2 className="text-xl font-bold mt-4 mb-2">Transaction History</h2>
      <div className="overflow-x-auto">
        <table className="table-auto min-w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Licensee</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {displayedTransactions.map((transaction, index) => (
              <tr key={index}>
                <td>{new Date(transaction.date).toLocaleDateString()}</td>
                <td>{transaction.licensee}</td>
                <td>{transaction.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between mt-4">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="bg-gray-300 text-black px-4 py-2 rounded"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage * itemsPerPage >= transactionHistory.length}
            className="bg-gray-300 text-black px-4 py-2 rounded"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoyaltyDashboard;
