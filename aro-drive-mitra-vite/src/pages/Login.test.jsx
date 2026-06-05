import { render, screen } from '@testing-library/react';
import Login from './Login';
import { vi } from 'vitest';

// Mock Firebase auth
vi.mock('../firebase/config', () => ({
  auth: {
    // Mock auth methods as needed
  },
}));

describe('Login Page', () => {
  test('renders login form', () => {
    render(<Login />);
    
    // Check if heading is present
    const heading = screen.getByRole('heading', { name: /aro drive merchant/i });
    expect(heading).toBeInTheDocument();
    
    // Check if email input is present
    const emailInput = screen.getByLabelText(/email merchant/i);
    expect(emailInput).toBeInTheDocument();
    
    // Check if password input is present
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toBeInTheDocument();
    
    // Check if submit button is present
    const submitButton = screen.getByRole('button', { name: /masuk dashboard/i });
    expect(submitButton).toBeInTheDocument();
  });
});