import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImagePreview } from './ImagePreview';

describe('private image display', () => {
  it('renders signed URLs directly and opens an uncropped preview without optimization', () => {
    const src = 'https://storage.googleapis.com/private/image.jpg?signature=secret';
    render(<ImagePreview src={src} name="Milk" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', src);
    expect(screen.getByRole('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
    fireEvent.click(screen.getByRole('button', { name: 'View image of Milk' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(2);
  });
  it('shows a localized fallback for unavailable images and retries a fresh URL', () => {
    const { rerender } = render(<ImagePreview name="Milk" />);
    expect(screen.getByRole('img', { name: 'Image unavailable' })).not.toHaveAttribute('src');
    rerender(<ImagePreview src="https://storage.googleapis.com/expired" name="Milk" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Image unavailable' })).toBeInTheDocument();
    rerender(<ImagePreview src="https://storage.googleapis.com/fresh" name="Milk" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://storage.googleapis.com/fresh');
  });
});
