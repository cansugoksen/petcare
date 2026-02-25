import { StyleSheet, View } from 'react-native';

export function LandscapeBackground() {
  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.skyGlowA} />
      <View style={styles.skyGlowB} />

      <View style={styles.farHillLeft} />
      <View style={styles.farHillRight} />
      <View style={styles.midHill} />
      <View style={styles.frontHill} />
      <View style={styles.grassBand} />
      <View style={[styles.grassTuft, { left: '6%', bottom: 78, transform: [{ scale: 1.1 }] }]} />
      <View style={[styles.grassTuft, { left: '16%', bottom: 80, transform: [{ scale: 0.8 }] }]} />
      <View style={[styles.grassTuft, { left: '30%', bottom: 77, transform: [{ scale: 1.15 }] }]} />
      <View style={[styles.grassTuft, { left: '47%', bottom: 81, transform: [{ scale: 0.9 }] }]} />
      <View style={[styles.grassTuft, { left: '64%', bottom: 78, transform: [{ scale: 1.05 }] }]} />
      <View style={[styles.grassTuft, { left: '82%', bottom: 79, transform: [{ scale: 0.95 }] }]} />

      <Tree style={{ left: '8%', bottom: 150, transform: [{ scale: 0.9 }] }} />
      <Tree style={{ left: '18%', bottom: 146, transform: [{ scale: 1.05 }] }} />
      <Tree style={{ left: '28%', bottom: 154, transform: [{ scale: 0.82 }] }} />
      <Tree style={{ left: '73%', bottom: 148, transform: [{ scale: 0.95 }] }} />
      <Tree style={{ left: '83%', bottom: 142, transform: [{ scale: 1.08 }] }} />

      <View style={[styles.house, { left: '40%', bottom: 146 }]}>
        <View style={styles.houseRoof} />
        <View style={styles.houseBody} />
      </View>
      <View style={[styles.house, { left: '52%', bottom: 152, transform: [{ scale: 0.85 }] }]}>
        <View style={styles.houseRoof} />
        <View style={styles.houseBody} />
      </View>

      <DogSilhouette style={{ left: '7%', bottom: 102, transform: [{ scale: 1.02 }] }} />
      <RabbitSilhouette style={{ left: '18%', bottom: 132, transform: [{ scale: 0.82 }] }} />
      <CatSilhouette style={{ left: '28%', bottom: 110, transform: [{ scale: 0.94 }] }} />
      <DogSilhouette style={{ left: '40%', bottom: 162, transform: [{ scale: 0.66 }] }} />
      <FoxSilhouette style={{ left: '50%', bottom: 118, transform: [{ scale: 0.9 }] }} />
      <SnakeSilhouette style={{ left: '61%', bottom: 98, transform: [{ scale: 1.02 }] }} />
      <CatSilhouette style={{ left: '70%', bottom: 146, transform: [{ scale: 0.76 }] }} />
      <RabbitSilhouette style={{ left: '79%', bottom: 104, transform: [{ scale: 0.9 }] }} />
      <DogSilhouette style={{ left: '86%', bottom: 170, transform: [{ scale: 0.58 }] }} />

      <CatSilhouette style={{ left: '12%', bottom: 182, transform: [{ scale: 0.56 }] }} />
      <RabbitSilhouette style={{ left: '24%', bottom: 196, transform: [{ scale: 0.48 }] }} />
      <SnakeSilhouette style={{ left: '54%', bottom: 188, transform: [{ scale: 0.58 }] }} />
      <FoxSilhouette style={{ left: '66%', bottom: 196, transform: [{ scale: 0.5 }] }} />
      <DogSilhouette style={{ left: '77%', bottom: 206, transform: [{ scale: 0.46 }] }} />

      <BirdSilhouette style={{ left: '67%', bottom: 214 }} />
      <BirdSilhouette style={{ left: '76%', bottom: 228, transform: [{ scale: 0.9 }] }} />
      <BirdSilhouette style={{ left: '31%', bottom: 202, transform: [{ scale: 0.75 }] }} />
      <BirdSilhouette style={{ left: '18%', bottom: 240, transform: [{ scale: 0.85 }] }} />
      <BirdSilhouette style={{ left: '58%', bottom: 246, transform: [{ scale: 0.78 }] }} />
      <BirdSilhouette style={{ left: '9%', bottom: 284, transform: [{ scale: 0.68 }] }} />
      <BirdSilhouette style={{ left: '42%', bottom: 272, transform: [{ scale: 0.72 }] }} />
      <BirdSilhouette style={{ left: '83%', bottom: 292, transform: [{ scale: 0.66 }] }} />
    </View>
  );
}

function Tree({ style }) {
  return (
    <View style={[styles.tree, style]}>
      <View style={styles.treeCrownA} />
      <View style={styles.treeCrownB} />
      <View style={styles.treeTrunk} />
    </View>
  );
}

function DogSilhouette({ style }) {
  return (
    <View style={[styles.dog, style]}>
      <View style={styles.dogBody} />
      <View style={styles.dogHead} />
      <View style={[styles.dogLeg, { left: 5 }]} />
      <View style={[styles.dogLeg, { left: 12 }]} />
      <View style={[styles.dogLeg, { left: 22 }]} />
      <View style={[styles.dogLeg, { left: 29 }]} />
      <View style={styles.dogTail} />
      <View style={styles.dogEar} />
    </View>
  );
}

function CatSilhouette({ style }) {
  return (
    <View style={[styles.cat, style]}>
      <View style={styles.catBody} />
      <View style={styles.catHead} />
      <View style={[styles.catEar, { left: 18, transform: [{ rotate: '-15deg' }] }]} />
      <View style={[styles.catEar, { left: 24, transform: [{ rotate: '15deg' }] }]} />
      <View style={styles.catTail} />
    </View>
  );
}

function SnakeSilhouette({ style }) {
  return (
    <View style={[styles.snakeWrap, style]}>
      <View style={styles.snakeLong} />
      <View style={styles.snakeHead} />
    </View>
  );
}

function BirdSilhouette({ style }) {
  return (
    <View style={[styles.birdWrap, style]}>
      <View style={styles.birdWingLeft} />
      <View style={styles.birdWingRight} />
    </View>
  );
}

function RabbitSilhouette({ style }) {
  return (
    <View style={[styles.rabbit, style]}>
      <View style={styles.rabbitBody} />
      <View style={styles.rabbitHead} />
      <View style={[styles.rabbitEar, { left: 18, height: 8 }]} />
      <View style={[styles.rabbitEar, { left: 22, height: 10 }]} />
      <View style={styles.rabbitTail} />
    </View>
  );
}

function FoxSilhouette({ style }) {
  return (
    <View style={[styles.fox, style]}>
      <View style={styles.foxBody} />
      <View style={styles.foxHead} />
      <View style={styles.foxEar} />
      <View style={styles.foxTail} />
      <View style={[styles.foxLeg, { left: 8 }]} />
      <View style={[styles.foxLeg, { left: 17 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.86,
  },
  skyGlowA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(95, 182, 246, 0.42)',
    top: -20,
    left: -40,
  },
  skyGlowB: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(170, 226, 198, 0.34)',
    top: 40,
    right: -80,
  },
  farHillLeft: {
    position: 'absolute',
    left: -60,
    right: '42%',
    bottom: 120,
    height: 140,
    borderTopLeftRadius: 90,
    borderTopRightRadius: 120,
    backgroundColor: 'rgba(120, 198, 171, 0.28)',
  },
  farHillRight: {
    position: 'absolute',
    left: '44%',
    right: -80,
    bottom: 114,
    height: 170,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 110,
    backgroundColor: 'rgba(112, 175, 210, 0.3)',
  },
  midHill: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: 86,
    height: 120,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: 'rgba(120, 190, 126, 0.28)',
  },
  frontHill: {
    position: 'absolute',
    left: -30,
    right: -30,
    bottom: -8,
    height: 124,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    backgroundColor: 'rgba(97, 176, 108, 0.28)',
  },
  grassBand: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: 52,
    height: 42,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: 'rgba(84, 173, 95, 0.22)',
  },
  grassTuft: {
    position: 'absolute',
    width: 14,
    height: 18,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(73, 163, 86, 0.24)',
  },
  tree: {
    position: 'absolute',
    width: 22,
    height: 44,
  },
  treeCrownA: {
    position: 'absolute',
    top: 4,
    left: 2,
    width: 18,
    height: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(70, 138, 93, 0.32)',
  },
  treeCrownB: {
    position: 'absolute',
    top: 0,
    left: 6,
    width: 10,
    height: 18,
    borderRadius: 8,
    backgroundColor: 'rgba(82, 156, 105, 0.34)',
  },
  treeTrunk: {
    position: 'absolute',
    bottom: 0,
    left: 9,
    width: 4,
    height: 18,
    borderRadius: 3,
    backgroundColor: 'rgba(98, 111, 116, 0.22)',
  },
  house: {
    position: 'absolute',
    width: 26,
    height: 24,
    opacity: 0.85,
  },
  houseRoof: {
    position: 'absolute',
    top: 0,
    left: 1,
    right: 1,
    height: 10,
    backgroundColor: 'rgba(104, 122, 135, 0.3)',
    transform: [{ skewX: '-18deg' }],
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  houseBody: {
    position: 'absolute',
    bottom: 0,
    left: 3,
    right: 3,
    height: 14,
    borderRadius: 3,
    backgroundColor: 'rgba(130, 151, 162, 0.26)',
  },
  dog: {
    position: 'absolute',
    width: 40,
    height: 22,
    opacity: 0.75,
  },
  dogBody: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 22,
    height: 9,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 104, 70, 0.42)',
  },
  dogHead: {
    position: 'absolute',
    left: 26,
    top: 5,
    width: 10,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(148, 104, 70, 0.42)',
  },
  dogEar: {
    position: 'absolute',
    left: 31,
    top: 2,
    width: 4,
    height: 5,
    borderRadius: 2,
    backgroundColor: 'rgba(126, 86, 58, 0.42)',
  },
  dogLeg: {
    position: 'absolute',
    top: 15,
    width: 3,
    height: 6,
    borderRadius: 2,
    backgroundColor: 'rgba(120, 84, 58, 0.34)',
  },
  dogTail: {
    position: 'absolute',
    left: 5,
    top: 6,
    width: 8,
    height: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(120, 84, 58, 0.3)',
    transform: [{ rotate: '-28deg' }],
  },
  cat: {
    position: 'absolute',
    width: 34,
    height: 24,
    opacity: 0.72,
  },
  catBody: {
    position: 'absolute',
    left: 8,
    top: 9,
    width: 16,
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(116, 123, 132, 0.42)',
  },
  catHead: {
    position: 'absolute',
    left: 20,
    top: 5,
    width: 10,
    height: 8,
    borderRadius: 5,
    backgroundColor: 'rgba(116, 123, 132, 0.42)',
  },
  catEar: {
    position: 'absolute',
    top: 2,
    width: 4,
    height: 5,
    borderRadius: 1,
    backgroundColor: 'rgba(116, 123, 132, 0.36)',
  },
  catTail: {
    position: 'absolute',
    left: 4,
    top: 6,
    width: 12,
    height: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(116, 123, 132, 0.34)',
    transform: [{ rotate: '-36deg' }],
  },
  snakeWrap: {
    position: 'absolute',
    width: 34,
    height: 12,
    opacity: 0.72,
  },
  snakeLong: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 30,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(84, 162, 76, 0.44)',
  },
  snakeHead: {
    position: 'absolute',
    left: 28,
    top: 3,
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(84, 162, 76, 0.48)',
  },
  birdWrap: {
    position: 'absolute',
    width: 24,
    height: 12,
    opacity: 0.72,
  },
  birdWingLeft: {
    position: 'absolute',
    left: 2,
    top: 4,
    width: 10,
    height: 6,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(78, 120, 168, 0.52)',
    borderTopLeftRadius: 8,
    transform: [{ rotate: '22deg' }],
  },
  birdWingRight: {
    position: 'absolute',
    left: 11,
    top: 4,
    width: 10,
    height: 6,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(78, 120, 168, 0.52)',
    borderTopRightRadius: 8,
    transform: [{ rotate: '-22deg' }],
  },
  rabbit: {
    position: 'absolute',
    width: 26,
    height: 20,
    opacity: 0.7,
  },
  rabbitBody: {
    position: 'absolute',
    left: 6,
    top: 8,
    width: 12,
    height: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(170, 156, 136, 0.42)',
  },
  rabbitHead: {
    position: 'absolute',
    left: 15,
    top: 5,
    width: 7,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(170, 156, 136, 0.42)',
  },
  rabbitEar: {
    position: 'absolute',
    top: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(170, 156, 136, 0.36)',
  },
  rabbitTail: {
    position: 'absolute',
    left: 3,
    top: 9,
    width: 4,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(170, 156, 136, 0.32)',
  },
  fox: {
    position: 'absolute',
    width: 32,
    height: 20,
    opacity: 0.72,
  },
  foxBody: {
    position: 'absolute',
    left: 6,
    top: 8,
    width: 16,
    height: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(201, 126, 70, 0.42)',
  },
  foxHead: {
    position: 'absolute',
    left: 20,
    top: 6,
    width: 8,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(201, 126, 70, 0.42)',
  },
  foxEar: {
    position: 'absolute',
    left: 23,
    top: 2,
    width: 4,
    height: 5,
    borderRadius: 2,
    backgroundColor: 'rgba(201, 126, 70, 0.34)',
  },
  foxTail: {
    position: 'absolute',
    left: 1,
    top: 7,
    width: 10,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(201, 126, 70, 0.3)',
    transform: [{ rotate: '-26deg' }],
  },
  foxLeg: {
    position: 'absolute',
    top: 14,
    width: 2,
    height: 5,
    borderRadius: 1,
    backgroundColor: 'rgba(201, 126, 70, 0.26)',
  },
});
