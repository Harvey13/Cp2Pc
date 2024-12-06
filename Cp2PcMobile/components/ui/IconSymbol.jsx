import { Ionicons } from '@expo/vector-icons';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  ...props
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      style={style}
      {...props}
    />
  );
}
