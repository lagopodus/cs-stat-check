import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Steam player lookup hero copy', () => {
  render(<App />);
  const headline = screen.getByText(/Steam player lookup/i);
  expect(headline).toBeInTheDocument();
  const helperText = screen.getByText(/append it to the URL/i);
  expect(helperText).toBeInTheDocument();
});
