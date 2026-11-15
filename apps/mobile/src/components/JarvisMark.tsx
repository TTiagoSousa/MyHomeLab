import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../theme/useColors';

const JarvisMark = ({ size = 40, centered = false }: { size?: number; centered?: boolean }) => {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox='0 0 40 40' style={centered ? { alignSelf: 'center' } : undefined}>
      <Circle cx='20' cy='20' r='18' fill='none' stroke={colors.accentDeep} strokeWidth='1.4' />
      <Circle cx='20' cy='20' r='13' fill='none' stroke={colors.accent} strokeWidth='1.6' strokeDasharray='30 12' />
      <Circle cx='20' cy='20' r='6.5' fill={colors.accent} opacity={0.22} />
      <Circle cx='20' cy='20' r='3.4' fill={colors.accentBright} />
    </Svg>
  );
};

export default JarvisMark;
