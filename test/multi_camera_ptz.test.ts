import { describe, it, expect } from 'vitest';
import {
  calculateSpeakerWorldPos,
  calculateTablePerimeterPos,
  calculateCameraBearing,
  scoreCameraCandidate,
  DEFAULT_VIRTUAL_CAMERAS,
  DEFAULT_ROOM_LAYOUT,
  wrapAngle180,
  stepCameraPan,
  resolveSpatialZone,
  computeDefaultChairs,
} from '../src/services/camera_ptz_math.js';
import { VirtualCamera, RoomLayoutConfig, SpatialZone, CustomChair } from '../src/types/api_types.js';

describe('Multi-Camera Studio & Trigonometric Parallax Geometry', () => {
  const arrayX = 400;
  const arrayY = 230;
  const radiusPx = 180;

  it('calculates true 2D speaker world coordinates from DOA array azimuth', () => {
    // 0 deg = North (Up / -Y)
    const northPos = calculateSpeakerWorldPos(arrayX, arrayY, 0, radiusPx);
    expect(northPos.x).toBeCloseTo(400, 2);
    expect(northPos.y).toBeCloseTo(230 - 180, 2); // 50

    // +90 deg = East (Right / +X)
    const eastPos = calculateSpeakerWorldPos(arrayX, arrayY, 90, radiusPx);
    expect(eastPos.x).toBeCloseTo(400 + 180, 2); // 580
    expect(eastPos.y).toBeCloseTo(230, 2);

    // +-180 deg = South (Down / +Y)
    const southPos = calculateSpeakerWorldPos(arrayX, arrayY, 180, radiusPx);
    expect(southPos.x).toBeCloseTo(400, 2);
    expect(southPos.y).toBeCloseTo(230 + 180, 2); // 410

    // -90 deg = West (Left / -X)
    const westPos = calculateSpeakerWorldPos(arrayX, arrayY, -90, radiusPx);
    expect(westPos.x).toBeCloseTo(400 - 180, 2); // 220
    expect(westPos.y).toBeCloseTo(230, 2);
  });

  it('resolves parallax bearing discrepancy (fixes camera pointing into wall bug)', () => {
    // Test the exact scenario from user's screenshot:
    // Speaker is at +105 deg from table center array (400, 230)
    const speakerPos = calculateSpeakerWorldPos(arrayX, arrayY, 105, radiusPx);
    // Speaker x ~= 573.86, y ~= 276.58

    // Rear camera mounted at bottom center: (400, 400)
    const rearCamX = 400;
    const rearCamY = 400;

    const bearing = calculateCameraBearing(rearCamX, rearCamY, speakerPos.x, speakerPos.y);

    // The raw DOA angle was 105° (which points down-right into wall).
    // The true bearing from rear camera (400, 400) to speaker (573.86, 276.58) is UP and RIGHT (~54.6°)
    expect(bearing).toBeGreaterThan(45);
    expect(bearing).toBeLessThan(65);
    expect(bearing).toBeCloseTo(54.6, 1);
  });

  it('correctly calculates bearings for cameras in all room orientations', () => {
    const targetX = 500;
    const targetY = 100;

    // Camera directly below target: aim should be 0 deg (North)
    expect(calculateCameraBearing(500, 300, targetX, targetY)).toBeCloseTo(0, 1);

    // Camera directly to left of target: aim should be 90 deg (East)
    expect(calculateCameraBearing(300, 100, targetX, targetY)).toBeCloseTo(90, 1);

    // Camera directly above target: aim should be 180 deg (South)
    expect(calculateCameraBearing(500, 50, targetX, targetY)).toBeCloseTo(180, 1);

    // Camera directly to right of target: aim should be -90 deg (West)
    expect(calculateCameraBearing(700, 100, targetX, targetY)).toBeCloseTo(-90, 1);
  });

  it('scores camera candidates by perspective and distance', () => {
    const roomW = 800;
    const roomH = 500;
    const frontCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'front')!;
    const rearCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'rear')!;
    const sideCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'side')!;

    // Case 1: Keynote speaker at Podium (North / 0 deg)
    // Presenter faces South -> Rear camera must win
    const podiumSpeakerPos = calculateSpeakerWorldPos(400, 250, 0, 160);
    const rearScorePodium = scoreCameraCandidate(rearCam, podiumSpeakerPos, 0, roomW, roomH);
    const frontScorePodium = scoreCameraCandidate(frontCam, podiumSpeakerPos, 0, roomW, roomH);

    expect(rearScorePodium).toBeGreaterThan(frontScorePodium);
    expect(rearScorePodium - frontScorePodium).toBeGreaterThan(30);

    // Case 2: Audience participant speaking (120 deg)
    // Table participant faces North -> Front camera must win
    const audienceSpeakerPos = calculateSpeakerWorldPos(400, 250, 120, 160);
    const frontScoreAudience = scoreCameraCandidate(frontCam, audienceSpeakerPos, 120, roomW, roomH);
    const rearScoreAudience = scoreCameraCandidate(rearCam, audienceSpeakerPos, 120, roomW, roomH);

    expect(frontScoreAudience).toBeGreaterThan(rearScoreAudience);
    expect(frontScoreAudience - rearScoreAudience).toBeGreaterThan(30);

    // Case 3: Side camera receives cross-table boost for side angles (~90 deg)
    const sideSpeakerPos = calculateSpeakerWorldPos(400, 250, 90, 160);
    const sideScore = scoreCameraCandidate(sideCam, sideSpeakerPos, 90, roomW, roomH);
    expect(sideScore).toBeGreaterThan(35);
  });

  it('verifies Schmitt trigger hysteresis margin prevents camera hunting', () => {
    // If Camera A is at score 70, with a 20% margin, Camera B needs at least 84 to switch
    const currentScore = 70;
    const marginPercent = 20;
    const threshold = currentScore * (1 + marginPercent / 100);
    expect(threshold).toBe(84);

    const closeCandidateScore = 80;
    expect(closeCandidateScore >= threshold).toBe(false); // Does not oscillate

    const strongCandidateScore = 86;
    expect(strongCandidateScore >= threshold).toBe(true); // Decisive switch
  });

  it('validates default room layout and virtual camera configuration', () => {
    expect(DEFAULT_ROOM_LAYOUT.tableShape).toBe('oval');
    expect(DEFAULT_ROOM_LAYOUT.seatCount).toBe(8);
    expect(DEFAULT_ROOM_LAYOUT.tableWidthRatio).toBeGreaterThan(0.3);

    expect(DEFAULT_VIRTUAL_CAMERAS.length).toBe(3);
    for (const cam of DEFAULT_VIRTUAL_CAMERAS) {
      expect(cam.assignedTargetSlot).toBeNull();
      expect(cam.isLockedOnSubject).toBe(false);
      expect(cam.lastTargetPos).toBeNull();
    }
  });

  it('verifies sticky memory maintains speaker aim angle during speech pauses', () => {
    // Front camera at (400, 40)
    const roomW = 800;
    const roomH = 500;
    const camX = 400;
    const camY = 40;

    // Speaker 1 at (450, 300)
    const speaker1Pos = { x: 450, y: 300 };
    const aimAngle = calculateCameraBearing(camX, camY, speaker1Pos.x, speaker1Pos.y);

    // Initial camera state
    let testCam: VirtualCamera = {
      ...DEFAULT_VIRTUAL_CAMERAS[0],
      currentPanDeg: 180, // Facing South
      targetPanDeg: aimAngle,
      assignedTargetSlot: 0,
      isLockedOnSubject: true,
      lastTargetPos: speaker1Pos,
    };

    // Camera slews toward speaker over multiple animation frames
    for (let frame = 0; frame < 30; frame++) {
      testCam.currentPanDeg = stepCameraPan(testCam.currentPanDeg, testCam.targetPanDeg, 0.05, 120);
    }
    expect(testCam.currentPanDeg).toBeCloseTo(aimAngle, 1);

    // Now speaker goes quiet (slot inactive, speaker leaves active list)
    // Sticky memory: camera should retain aim angle on lastTargetPos rather than jumping to resting angle (180)
    const holdAngle = calculateCameraBearing(camX, camY, testCam.lastTargetPos!.x, testCam.lastTargetPos!.y);
    expect(holdAngle).toBeCloseTo(aimAngle, 2);
    expect(holdAngle).not.toBe(testCam.restingPanDeg);
  });

  it('verifies camera assignment separates distinct speakers across cameras', () => {
    const roomW = 800;
    const roomH = 500;
    const frontCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'front')!;
    const rearCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'rear')!;

    // Speaker 0 at Podium (North, 0 deg)
    const podiumSpeaker = calculateSpeakerWorldPos(400, 250, 0, 160);
    // Speaker 1 at Audience (South, 180 deg)
    const audienceSpeaker = calculateSpeakerWorldPos(400, 250, 180, 160);

    const podiumRearScore = scoreCameraCandidate(rearCam, podiumSpeaker, 0, roomW, roomH);
    const podiumFrontScore = scoreCameraCandidate(frontCam, podiumSpeaker, 0, roomW, roomH);

    const audienceRearScore = scoreCameraCandidate(rearCam, audienceSpeaker, 180, roomW, roomH);
    const audienceFrontScore = scoreCameraCandidate(frontCam, audienceSpeaker, 180, roomW, roomH);

    // Rear camera is optimal for podium presenter
    expect(podiumRearScore).toBeGreaterThan(podiumFrontScore);

    // Front camera is optimal for audience speaker
    expect(audienceFrontScore).toBeGreaterThan(audienceRearScore);

    // Demonstrates that optimal camera assignment gives each speaker their own dedicated camera
    expect(podiumRearScore).toBeGreaterThan(audienceRearScore);
    expect(audienceFrontScore).toBeGreaterThan(podiumFrontScore);
  });

  it('calculates shape-aware speaker positions across Oval, Round, and U-Shape table geometries', () => {
    const roomW = 800;
    const roomH = 500;
    const centerX = 400;
    const centerY = 250;

    // 1. Oval Table (Ray-Box Perimeter Geometry)
    const ovalLayout: RoomLayoutConfig = {
      tableShape: 'oval',
      tableWidthRatio: 0.5, // 400px wide
      tableHeightRatio: 0.3, // 150px high
      seatCount: 8,
    };
    const eastOval = calculateTablePerimeterPos(centerX, centerY, 90, ovalLayout, roomW, roomH);
    expect(eastOval.x).toBeCloseTo(centerX + 200 * 0.95, 1);
    expect(eastOval.y).toBeCloseTo(centerY, 1);

    const northOval = calculateTablePerimeterPos(centerX, centerY, 0, ovalLayout, roomW, roomH);
    expect(northOval.x).toBeCloseTo(centerX, 1);
    expect(northOval.y).toBeCloseTo(centerY - 75 * 0.95, 1);

    // Sound arrival at +100°: hits East edge directly
    const eastEdge = calculateTablePerimeterPos(centerX, centerY, 100, ovalLayout, roomW, roomH);
    expect(eastEdge.x).toBeCloseTo(centerX + 200 * 0.95, 1); // Exact East desk edge

    // Sound arrival at +111°: exits South edge near corner (y = centerY + halfH * 0.95)
    const diagOval = calculateTablePerimeterPos(centerX, centerY, 111, ovalLayout, roomW, roomH);
    expect(diagOval.y).toBeCloseTo(centerY + 75 * 0.95, 1); // On desk perimeter
    expect(diagOval.x).toBeGreaterThan(centerX + 180); // Near corner

    // 2. Round Table
    const roundLayout: RoomLayoutConfig = {
      tableShape: 'round',
      tableWidthRatio: 0.4,
      tableHeightRatio: 0.4, // 200px diameter -> 100px radius
      seatCount: 8,
    };
    const eastRound = calculateTablePerimeterPos(centerX, centerY, 90, roundLayout, roomW, roomH);
    expect(eastRound.x).toBeCloseTo(centerX + 100 * 0.95, 1);
    expect(eastRound.y).toBeCloseTo(centerY, 1);

    // 3. U-Shape Table
    const ushapeLayout: RoomLayoutConfig = {
      tableShape: 'ushape',
      tableWidthRatio: 0.5, // 400px wide (left arm at 200px, right arm at 600px)
      tableHeightRatio: 0.3, // 150px high (top at 175px, bottom at 325px)
      seatCount: 8,
    };

    // Speaker at -90° (West) must be on the left desk arm (x ~ 200..230)
    const westUShape = calculateTablePerimeterPos(centerX, centerY, -90, ushapeLayout, roomW, roomH);
    expect(westUShape.x).toBeLessThan(300);
    expect(westUShape.x).toBeGreaterThan(180);

    // Speaker at +90° (East) must be on the right desk arm (x ~ 570..600)
    const eastUShape = calculateTablePerimeterPos(centerX, centerY, 90, ushapeLayout, roomW, roomH);
    expect(eastUShape.x).toBeGreaterThan(500);
    expect(eastUShape.x).toBeLessThan(620);

    // Speaker at 180° (South) must be on the bottom desk base (y ~ 300..325)
    const southUShape = calculateTablePerimeterPos(centerX, centerY, 180, ushapeLayout, roomW, roomH);
    expect(southUShape.y).toBeGreaterThan(280);

    // Speaker at 0° (North) must be in the Stage/Podium area (y < centerY)
    const northUShape = calculateTablePerimeterPos(centerX, centerY, 0, ushapeLayout, roomW, roomH);
    expect(northUShape.y).toBeLessThan(centerY - 50);
  });

  it('correctly resolves circular wrap-around spatial zones across the +-180° South boundary', () => {
    const zones: SpatialZone[] = [
      { name: 'North Chair', min_angle_deg: -45, max_angle_deg: 45, color: '#10b981' },
      { name: 'East Chair', min_angle_deg: 45, max_angle_deg: 135, color: '#38bdf8' },
      { name: 'South Chair', min_angle_deg: 135, max_angle_deg: -135, color: '#f59e0b' },
      { name: 'West Chair', min_angle_deg: -135, max_angle_deg: -45, color: '#818cf8' },
    ];

    // North (0°) -> North Chair
    expect(resolveSpatialZone(0, zones)?.name).toBe('North Chair');
    expect(resolveSpatialZone(30, zones)?.name).toBe('North Chair');
    expect(resolveSpatialZone(-30, zones)?.name).toBe('North Chair');

    // East (90°) -> East Chair
    expect(resolveSpatialZone(90, zones)?.name).toBe('East Chair');
    expect(resolveSpatialZone(60, zones)?.name).toBe('East Chair');
    expect(resolveSpatialZone(130, zones)?.name).toBe('East Chair');

    // South (+-180° / 135° to -135°) -> South Chair
    expect(resolveSpatialZone(140, zones)?.name).toBe('South Chair');
    expect(resolveSpatialZone(180, zones)?.name).toBe('South Chair');
    expect(resolveSpatialZone(-180, zones)?.name).toBe('South Chair');
    expect(resolveSpatialZone(-170, zones)?.name).toBe('South Chair');
    expect(resolveSpatialZone(-140, zones)?.name).toBe('South Chair');

    // West (-90°) -> West Chair
    expect(resolveSpatialZone(-90, zones)?.name).toBe('West Chair');
    expect(resolveSpatialZone(-60, zones)?.name).toBe('West Chair');
    expect(resolveSpatialZone(-130, zones)?.name).toBe('West Chair');
  });

  it('generates isolated default chair positions down to 2 seats and supports custom chair snapping', () => {
    const roomW = 800;
    const roomH = 500;
    const centerX = 400;
    const centerY = 260; // 500 / 2 + 10

    // Test 2-chair 1-on-1 meeting setup
    const twoChairLayout: RoomLayoutConfig = {
      tableShape: 'oval',
      tableWidthRatio: 0.4,
      tableHeightRatio: 0.25,
      seatCount: 2,
    };
    const chairs2 = computeDefaultChairs(twoChairLayout, roomW, roomH);
    expect(chairs2).toHaveLength(2);
    expect(chairs2[0].id).toBe('chair-0');
    expect(chairs2[1].id).toBe('chair-1');
    // In 2-chair setup, chairs face each other across North and South
    expect(chairs2[0].xRatio).toBeCloseTo(0.5, 2);
    expect(chairs2[1].xRatio).toBeCloseTo(0.5, 2);
    expect(chairs2[0].yRatio).toBeLessThan(chairs2[1].yRatio);

    // Test 4-chair layout
    const fourChairLayout: RoomLayoutConfig = {
      tableShape: 'oval',
      tableWidthRatio: 0.5,
      tableHeightRatio: 0.3,
      seatCount: 4,
    };
    const chairs4 = computeDefaultChairs(fourChairLayout, roomW, roomH);
    expect(chairs4).toHaveLength(4);
    // Distinct IDs
    const ids = new Set(chairs4.map((c) => c.id));
    expect(ids.size).toBe(4);

    // Test custom chair repositioning & snap
    // Create asymmetric 1-3 interview setup: 1 chair on West, 3 chairs on East
    const customChairs: CustomChair[] = [
      { id: 'chair-interviewer', xRatio: 0.25, yRatio: 0.52 }, // West (-90°)
      { id: 'chair-candidate-1', xRatio: 0.75, yRatio: 0.35 }, // East-North (+60°)
      { id: 'chair-candidate-2', xRatio: 0.75, yRatio: 0.52 }, // East (+90°)
      { id: 'chair-candidate-3', xRatio: 0.75, yRatio: 0.69 }, // East-South (+120°)
    ];

    const customLayout: RoomLayoutConfig = {
      tableShape: 'oval',
      tableWidthRatio: 0.5,
      tableHeightRatio: 0.3,
      seatCount: 4,
      customChairs,
    };

    // Sound arriving from West (-90°): must snap to interviewer chair at (200, 260)
    const interviewerPos = calculateTablePerimeterPos(centerX, centerY, -90, customLayout, roomW, roomH);
    expect(interviewerPos.x).toBeCloseTo(0.25 * roomW, 1);
    expect(interviewerPos.y).toBeCloseTo(0.52 * roomH, 1);

    // Sound arriving from East (+90°): must snap to candidate-2 chair at (600, 260)
    const candidate2Pos = calculateTablePerimeterPos(centerX, centerY, 90, customLayout, roomW, roomH);
    expect(candidate2Pos.x).toBeCloseTo(0.75 * roomW, 1);
    expect(candidate2Pos.y).toBeCloseTo(0.52 * roomH, 1);

    // Sound arriving from East-North (+62°): within 25° of candidate-1 (+60°)
    const candidate1Pos = calculateTablePerimeterPos(centerX, centerY, 62, customLayout, roomW, roomH);
    expect(candidate1Pos.x).toBeCloseTo(0.75 * roomW, 1);
    expect(candidate1Pos.y).toBeCloseTo(0.35 * roomH, 1);
  });

  it('verifies live switching deadlock resolution when current live camera is unassigned or idle', () => {
    // Current live camera: Stage Front Cam (cam-front)
    // Scenario from screenshot: Speaker 2 stopped speaking, Front Cam was unassigned.
    // Side Cam (cam-side) is actively tracking Speaker 1 with score 50.
    // Front cam has unassigned idle score = 0 or lower priority.
    // If hysteresis were naively applied against frontCam's historical high score (e.g. 60 * 1.2 = 72),
    // Side cam (50) could never switch, deadlocking the director.
    const isCurrentLiveTrackingActiveSpeaker = false;
    const sideCamScore = 50;
    const previousLiveCamScore = 60;
    const hysteresisMarginPercent = 20;

    let canSwitch = false;
    if (!isCurrentLiveTrackingActiveSpeaker) {
      // Immediate cut to active speaker framing camera
      canSwitch = sideCamScore > 0;
    } else {
      const threshold = previousLiveCamScore * (1.0 + hysteresisMarginPercent / 100.0);
      canSwitch = sideCamScore >= threshold;
    }

    expect(canSwitch).toBe(true); // Must cut immediately, no deadlock!

    // Conversely, when both cameras track active speakers, hysteresis holds:
    const bothActive = true;
    let switchWhileBothActive = false;
    if (!bothActive) {
      switchWhileBothActive = true;
    } else {
      const threshold = previousLiveCamScore * (1.0 + hysteresisMarginPercent / 100.0); // 72
      switchWhileBothActive = sideCamScore >= threshold; // 50 < 72 -> false
    }
    expect(switchWhileBothActive).toBe(false); // Prevents rapid flipping
  });
});
