import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ethers } from 'ethers';
import { useLit } from './useLitProtocol'; // Custom Lit Protocol hook for encryption/decryption
import { markAllAsRead, addNotification } from '../redux/actions/notificationActions'; // Redux actions for notifications
import './Notification.css'; // Assuming custom CSS for styling

const Notification = () => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const dispatch = useDispatch();
  const notifications = useSelector((state) => state.notifications); // Fetch notifications from Redux store
  const { decryptData } = useLit(); // Lit Protocol hook for decryption

  // Fetch blockchain events and listen for notifications
  const fetchEvents = async () => {
    try {
      setLoading(true);
      // Replace with your provider URL and actual contract details
      const provider = new ethers.providers.JsonRpcProvider('YOUR_PROVIDER_URL');
      const contractAddress = 'YOUR_CONTRACT_ADDRESS';
      const contractABI = [
        'event PaymentReceived(address indexed user, uint256 amount)',
        // Add other event ABI definitions here
      ];

      const contract = new ethers.Contract(contractAddress, contractABI, provider);

      // Listen for PaymentReceived events
      contract.on('PaymentReceived', async (user, amount) => {
        const notification = {
          type: 'Payment',
          message: `Payment of ${ethers.utils.formatEther(amount)} received from ${user}`,
          timestamp: new Date(),
        };
        dispatch(addNotification(notification)); // Dispatch new notification to Redux store
      });

      // Add additional event listeners here for cross-chain transfers, licensing, etc.
    } catch (error) {
      setErrorMessage('Failed to fetch events.');
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle decryption for encrypted notifications
  const handleDecryptNotification = async (encryptedNotification) => {
    try {
      const decrypted = await decryptData(encryptedNotification.content);
      alert(`Decrypted Content: ${decrypted}`);
    } catch (error) {
      setErrorMessage('Failed to decrypt notification.');
      console.error('Error decrypting notification:', error);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead()); // Dispatch action to mark notifications as read
  };

  // Fetch blockchain events when the component loads
  useEffect(() => {
    fetchEvents();
  }, []); // Empty dependency array ensures this runs only on mount

  return (
    <div className="notification-dropdown">
      <h4>Notifications</h4>
      {loading && <p>Loading...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="notification-list">
        {notifications.length > 0 ? (
          notifications.map((notification, index) => (
            <div
              key={index}
              className={`notification-item notification-${notification.type.toLowerCase()}`}
            >
              <div className="notification-message">{notification.message}</div>
              <div className="notification-timestamp">
                {new Date(notification.timestamp).toLocaleString()}
              </div>
              {notification.encrypted && (
                <button
                  className="btn btn-light"
                  onClick={() => handleDecryptNotification(notification)}
                >
                  Decrypt
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No notifications</p>
        )}
      </div>

      <div className="notification-actions">
        <button
          className="btn btn-light"
          onClick={handleMarkAllAsRead}
          disabled={notifications.length === 0}
        >
          Mark All as Read
        </button>
      </div>
    </div>
  );
};

export default Notification;
