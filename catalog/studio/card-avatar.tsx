import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export const MyAnimation = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const entrance = spring({ frame, fps, config: { damping: 16 } })
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#eef4f2',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Geist, sans-serif',
      }}
    >
      <div
        style={{
          width: 720,
          border: '1px solid rgba(15, 45, 42, 0.16)',
          borderRadius: 32,
          padding: 48,
          backgroundColor: '#ffffff',
          color: '#16312e',
          opacity,
          transform: `translateY(${(1 - entrance) * 48}px) scale(${0.96 + entrance * 0.04})`,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 650 }}>Terence</div>
        <div style={{ marginTop: 12, fontSize: 34, color: '#47706b' }}>
          Motion systems · RemotionHub
        </div>
      </div>
    </AbsoluteFill>
  )
}
