import { Text } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

const fontSizes = {
  title: 34,
  subtitle: 20,
  default: 16,
  defaultSemiBold: 16,
  button: 16,
};

const fontWeights = {
  title: 'bold',
  subtitle: 'bold',
  default: 'normal',
  defaultSemiBold: '600',
  button: '600',
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', ...otherProps }) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const fontSize = fontSizes[type];
  const fontWeight = fontWeights[type];

  return (
    <Text
      style={[
        {
          color,
          fontSize,
          fontWeight,
        },
        style,
      ]}
      {...otherProps}
    />
  );
}
