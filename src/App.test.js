import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Steam integrity scanner hero copy', () => {
  render(<App />);
  const headline = screen.getByText(/Steam integrity scanner/i);
  expect(headline).toBeInTheDocument();
  const helperText = screen.getByText(/is this guy legit/i);
  expect(helperText).toBeInTheDocument();
});
