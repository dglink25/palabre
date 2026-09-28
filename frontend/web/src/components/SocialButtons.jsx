import SocialButton from './SocialButton';

const ORDER = ['google', 'apple', 'facebook', 'github', 'tiktok'];

export default function SocialButtons({ onSelect, disabled }) {
  return (
    <div className="social-buttons">
      {ORDER.map((key) => (
        <SocialButton
          key={key}
          provider={key}
          disabled={disabled}
          onClick={() => onSelect(key)}
        />
      ))}
    </div>
  );
}