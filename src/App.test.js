import { render, screen } from '@testing-library/react';
import App from './App';

test('renders profile loader heading', () => {
  render(<App />);
  const heading = screen.getByText(/Steam Profile Loader/i);
  expect(heading).toBeInTheDocument();
});
