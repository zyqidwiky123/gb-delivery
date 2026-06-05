import React from 'react';
import Profile from './Profile';

/**
 * Account Page – Wrapper around the existing Profile component.
 * This provides a dedicated route for the "Account" tab while reusing
 * all profile display and edit logic already implemented in Profile.jsx.
 * Keeping it as a thin wrapper avoids code duplication and ensures any
 * future updates to Profile are reflected automatically.
 */
function Account() {
  return <Profile />;
}

export default Account;
