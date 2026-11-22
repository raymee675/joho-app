import { render } from '@testing-library/react';
import FormattedText from '../src/components/FormattedText';
it('上付き・下付き・改行を安全なテキストとして表示する', () => {
  const { container } = render(<FormattedText text={'2^8 + 2^{n−1}\nX_n X_{n+1} ^あ _あ <script>'} />);
  expect([...container.querySelectorAll('sup')].map(e => e.textContent)).toEqual(['8', 'n−1']);
  expect([...container.querySelectorAll('sub')].map(e => e.textContent)).toEqual(['n', 'n+1']);
  expect(container.textContent).toContain('\n');
  expect(container.textContent).toContain('^あ _あ <script>');
  expect(container.querySelector('script')).toBeNull();
});
