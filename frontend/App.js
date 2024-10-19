import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './redux/store'; // Redux store configuration
import HomePage from './pages/HomePage'; // Home page component
import ContentPage from './pages/ContentPage'; // Content page component
import ProfilePage from './pages/ProfilePage'; // Profile page component
import MembershipPage from './pages/MembershipPage'; // Membership page component
import LoginPage from './pages/LoginPage'; // Login page component
import Notifications from './components/Notification'; // Notification component
import PrivateRoute from './components/PrivateRoute'; // PrivateRoute component for protected routes
import { checkUserSession } from './redux/actions/authActions'; // Action to check user session
import './App.css'; // Styles for the application

const App = () => {
  // Check if user is authenticated on mount
  useEffect(() => {
    const fetchUserSession = async () => {
      try {
        await store.dispatch(checkUserSession());
      } catch (error) {
        console.error('Failed to check user session:', error);
      }
    };

    fetchUserSession();
  }, []);

  return (
    <Provider store={store}>
      <Router>
        <div className="App">
          <Notifications /> {/* Display notifications for user alerts */}
          <Switch>
            <Route exact path="/" component={HomePage} />
            <Route path="/login" component={LoginPage} />
            <PrivateRoute path="/content" component={ContentPage} />
            <PrivateRoute path="/profile" component={ProfilePage} />
            <PrivateRoute path="/membership" component={MembershipPage} />
            {/* Handle undefined routes with a dedicated 404 component */}
            <Route path="*">
              <NotFound />
            </Route>
          </Switch>
        </div>
      </Router>
    </Provider>
  );
};

// 404 Not Found Component
const NotFound = () => {
  return (
    <div className="not-found">
      <h2>404 Not Found</h2>
      <p>The page you are looking for does not exist.</p>
    </div>
  );
};

export default App;
