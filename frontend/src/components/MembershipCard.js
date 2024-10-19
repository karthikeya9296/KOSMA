import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import UnlockProtocol from '@unlock-protocol/unlock-js';
import './MembershipCard.css'; // Assuming you have styling

const MembershipCard = ({ membershipType, contractAddress }) => {
  const [membershipDetails, setMembershipDetails] = useState(null);
  const [userMembership, setUserMembership] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAccount, setCurrentAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [unlock, setUnlock] = useState(null);
  const [buttonLoading, setButtonLoading] = useState(null); // Track loading state of specific buttons

  // Initialize provider and Unlock instance on component load
  useEffect(() => {
    const initProvider = async () => {
      try {
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = web3Provider.getSigner();
        const unlockInstance = new UnlockProtocol(web3Provider);

        setProvider(web3Provider);
        setSigner(signer);
        setUnlock(unlockInstance);
      } catch (error) {
        setErrorMessage('Failed to initialize wallet. Make sure you have a Web3 wallet installed.');
        console.error('Error initializing wallet:', error);
      }
    };

    initProvider();
  }, []);

  // Memoize the contract to avoid unnecessary re-creations
  const contract = useMemo(() => {
    if (signer) {
      return new ethers.Contract(contractAddress, membershipType.abi, signer);
    }
    return null;
  }, [contractAddress, membershipType.abi, signer]);

  // Fetch membership details from the smart contract
  const fetchMembershipDetails = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      if (contract) {
        const price = await contract.price();
        const validity = await contract.validity();
        const benefits = await contract.getBenefits();

        setMembershipDetails({
          price: ethers.utils.formatEther(price),
          validity,
          benefits,
        });
      }
    } catch (error) {
      setErrorMessage('Failed to fetch membership details. Please try again.');
      console.error('Error fetching membership details:', error);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  // Check if user has an active membership
  const checkUserMembership = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      if (contract) {
        const userAddress = await signer.getAddress();
        setCurrentAccount(userAddress);

        // Check if the user has a valid membership key
        const membershipStatus = await contract.isMember(userAddress);
        setUserMembership(membershipStatus ? 'Active' : 'None');
      }
    } catch (error) {
      setErrorMessage('Failed to verify membership status. Please try again.');
      console.error('Error verifying membership status:', error);
    } finally {
      setLoading(false);
    }
  }, [contract, signer]);

  // Purchase membership via Unlock Protocol
  const purchaseMembership = async () => {
    try {
      setButtonLoading('purchase');
      setErrorMessage('');

      const lock = await unlock.getLock(contractAddress);
      const purchaseResult = await lock.purchaseMembershipFor(currentAccount);

      if (purchaseResult) {
        alert('Membership purchased successfully!');
        checkUserMembership(); // Re-check membership status after purchase
      }
    } catch (error) {
      setErrorMessage('Failed to purchase membership. Please ensure you have sufficient funds.');
      console.error('Error purchasing membership:', error);
    } finally {
      setButtonLoading(null);
    }
  };

  // Renew membership
  const renewMembership = async () => {
    try {
      setButtonLoading('renew');
      setErrorMessage('');

      if (contract) {
        const renewResult = await contract.renewMembership(currentAccount);

        if (renewResult) {
          alert('Membership renewed successfully!');
          checkUserMembership();
        }
      }
    } catch (error) {
      setErrorMessage('Failed to renew membership. Please try again.');
      console.error('Error renewing membership:', error);
    } finally {
      setButtonLoading(null);
    }
  };

  // Cancel membership
  const cancelMembership = async () => {
    try {
      if (!window.confirm('Are you sure you want to cancel your membership?')) {
        return;
      }
      setButtonLoading('cancel');
      setErrorMessage('');

      if (contract) {
        const cancelResult = await contract.cancelMembership(currentAccount);

        if (cancelResult) {
          alert('Membership canceled successfully!');
          checkUserMembership();
        }
      }
    } catch (error) {
      setErrorMessage('Failed to cancel membership. Please try again.');
      console.error('Error canceling membership:', error);
    } finally {
      setButtonLoading(null);
    }
  };

  // Fetch membership details and check user membership on load
  useEffect(() => {
    if (signer && contract) {
      fetchMembershipDetails();
      checkUserMembership();
    }
  }, [signer, contract, fetchMembershipDetails, checkUserMembership]);

  return (
    <div className={`membership-card membership-${membershipType.level.toLowerCase()}`}>
      <h2>{membershipType.level} Membership</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          {membershipDetails && (
            <div>
              <p>Price: {membershipDetails.price} ETH</p>
              <p>Validity: {membershipDetails.validity} days</p>
              <ul>
                {membershipDetails.benefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>

              <div className="membership-actions">
                {userMembership === 'Active' ? (
                  <>
                    <p>Status: Active</p>
                    <button
                      className="btn btn-primary"
                      onClick={renewMembership}
                      disabled={buttonLoading === 'renew'}
                    >
                      {buttonLoading === 'renew' ? 'Renewing...' : 'Renew Membership'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={cancelMembership}
                      disabled={buttonLoading === 'cancel'}
                    >
                      {buttonLoading === 'cancel' ? 'Canceling...' : 'Cancel Membership'}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-success"
                    onClick={purchaseMembership}
                    disabled={buttonLoading === 'purchase'}
                  >
                    {buttonLoading === 'purchase' ? 'Purchasing...' : 'Purchase Membership'}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MembershipCard;
