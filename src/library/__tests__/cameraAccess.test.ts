import { cameraGate } from '../cameraAccess';

describe('cameraGate', () => {
  const granted = { granted: true, status: 'granted' };
  const undetermined = { granted: false, status: 'undetermined' };
  const denied = { granted: false, status: 'denied' };

  it('waits until both the permission and the memory are known', () => {
    expect(cameraGate(null, true, false)).toBe('wait');
    expect(cameraGate(granted, null, false)).toBe('wait');
  });

  it('shows the camera when the browser says it is allowed', () => {
    expect(cameraGate(granted, false, false)).toBe('camera');
  });

  it('asks the first time, but starts the camera straight away once it has worked before', () => {
    expect(cameraGate(undetermined, false, false)).toBe('ask');
    expect(cameraGate(undetermined, true, false)).toBe('camera');
  });

  it('asks again if starting it straight away failed', () => {
    expect(cameraGate(undetermined, true, true)).toBe('ask');
  });

  it('falls back to the usual step when the browser can’t say', () => {
    expect(cameraGate('unknown', false, false)).toBe('ask');
    expect(cameraGate('unknown', true, false)).toBe('camera');
    expect(cameraGate('unknown', true, true)).toBe('ask');
  });

  it('points to settings when the camera was refused, even if it worked before', () => {
    expect(cameraGate(denied, true, false)).toBe('blocked');
  });
});
