import { describe, it, expect, vi, beforeEach } from 'vitest';

// These tests are RED — draw.ts does not exist yet.
// They will fail with "Cannot find module '../src/maps/draw'"

// Mock state/form module
vi.mock('../src/state/form', () => ({
  updateField: vi.fn(),
  formData: { value: { pitch: 'medium' } },
}));

// Mock state/map module
vi.mock('../src/state/map', () => ({
  drawingSqft: { value: 0 },
  mapError: { value: false },
  isDrawingActive: { value: false },
  hasFinishedPolygon: { value: false },
}));

describe('initDraw', () => {
  let mockDraw: any;
  let readyCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.resetModules();

    // Reset the 'ready' callback capture
    readyCallback = null;

    // Mock TerraDraw instance
    const startSpy = vi.fn();
    const onSpy = vi.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === 'ready') {
        readyCallback = cb;
      }
    });

    mockDraw = {
      start: startSpy,
      stop: vi.fn(),
      on: onSpy,
      getSnapshot: vi.fn().mockReturnValue([]),
      setMode: vi.fn(),
      removeFeatures: vi.fn(),
      addFeatures: vi.fn(),
    };

    const MockTerraDraw = vi.fn().mockReturnValue(mockDraw);
    const MockTerraDrawPolygonMode = vi.fn();
    const MockTerraDrawGoogleMapsAdapter = vi.fn();

    // Set up window globals Terra Draw would expose via UMD
    (window as any).terraDraw = {
      TerraDraw: MockTerraDraw,
      TerraDrawPolygonMode: MockTerraDrawPolygonMode,
    };
    (window as any).terraDrawGoogleMapsAdapter = {
      TerraDrawGoogleMapsAdapter: MockTerraDrawGoogleMapsAdapter,
    };

    // Mock Google Maps
    (window as any).google = {
      maps: {
        geometry: {
          spherical: {
            computeArea: vi.fn().mockReturnValue(100.0),
          },
        },
      },
    };
  });

  it('calls draw.start() before the ready event fires', async () => {
    const { initDraw } = await import('../src/maps/draw');

    const mockMap = {};
    // Don't fire ready — just check start was called immediately
    initDraw(mockMap);

    // start() must have been called synchronously during initDraw
    expect(mockDraw.start).toHaveBeenCalledOnce();
  });

  it('resolves the promise only after the ready event fires', async () => {
    const { initDraw } = await import('../src/maps/draw');

    const mockMap = {};
    let resolved = false;

    const promise = initDraw(mockMap).then(() => {
      resolved = true;
    });

    // Not yet resolved — waiting for ready event
    expect(resolved).toBe(false);

    // Fire the ready event
    if (readyCallback) readyCallback();

    await promise;
    expect(resolved).toBe(true);
  });
});

describe('destroyDraw', () => {
  beforeEach(() => {
    vi.resetModules();

    const mockDraw = {
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      getSnapshot: vi.fn().mockReturnValue([]),
      setMode: vi.fn(),
      removeFeatures: vi.fn(),
      addFeatures: vi.fn(),
    };

    (window as any).terraDraw = {
      TerraDraw: vi.fn().mockReturnValue(mockDraw),
      TerraDrawPolygonMode: vi.fn(),
    };
    (window as any).terraDrawGoogleMapsAdapter = {
      TerraDrawGoogleMapsAdapter: vi.fn(),
    };
    (window as any).google = {
      maps: { geometry: { spherical: { computeArea: vi.fn() } } },
    };
  });

  it('calls draw.stop() and resets drawInstance to null', async () => {
    const { initDraw, destroyDraw, _resetDrawForTesting } = await import('../src/maps/draw');

    _resetDrawForTesting();

    // Get reference to the mock draw before it fires ready
    let capturedDraw: any = null;
    const MockTerraDraw = (window as any).terraDraw.TerraDraw;
    MockTerraDraw.mockImplementation(() => {
      capturedDraw = {
        start: vi.fn(),
        stop: vi.fn(),
        on: vi.fn().mockImplementation((event: string, cb: () => void) => {
          if (event === 'ready') setTimeout(cb, 0);
        }),
        getSnapshot: vi.fn().mockReturnValue([]),
        setMode: vi.fn(),
        removeFeatures: vi.fn(),
        addFeatures: vi.fn(),
      };
      return capturedDraw;
    });

    const mockMap = {};
    await initDraw(mockMap);

    destroyDraw();

    expect(capturedDraw.stop).toHaveBeenCalledOnce();
  });
});

describe('startListeningForArea', () => {
  let mockDraw: any;
  let changeCallback: ((ids: string[], type: string) => void) | null = null;
  let finishCallback: ((id: string, context: { action: string; mode: string }) => void) | null = null;

  beforeEach(() => {
    vi.resetModules();
    changeCallback = null;
    finishCallback = null;

    mockDraw = {
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'change') changeCallback = cb;
        if (event === 'finish') finishCallback = cb;
      }),
      getSnapshot: vi.fn(),
      setMode: vi.fn(),
      removeFeatures: vi.fn(),
      addFeatures: vi.fn(),
    };

    (window as any).google = {
      maps: {
        geometry: {
          spherical: {
            computeArea: vi.fn().mockReturnValue(100.0),
          },
        },
      },
    };
  });

  it('wires change event — calls onAreaUpdate with computed sqft when polygon snapshot exists', async () => {
    const { startListeningForArea } = await import('../src/maps/draw');

    const onAreaUpdate = vi.fn();
    const polygonCoords = [
      [-83.0, 42.0],
      [-83.001, 42.001],
      [-83.002, 42.0],
      [-83.0, 42.0], // closed ring
    ];

    mockDraw.getSnapshot.mockReturnValue([
      {
        geometry: {
          type: 'Polygon',
          coordinates: [polygonCoords],
        },
        properties: { mode: 'polygon' },
      },
    ]);

    startListeningForArea(mockDraw, 'medium', onAreaUpdate);

    // Fire a change event with a non-delete type
    if (changeCallback) changeCallback(['feature-1'], 'create');

    // Should have called onAreaUpdate with sqft value (mock: 100m² × 10.7639 × 1.12 ≈ 1206)
    expect(onAreaUpdate).toHaveBeenCalledWith(1206);
  });

  it('wires finish event — calls updateField("sqft", ...) when action is "draw"', async () => {
    const { updateField } = await import('../src/state/form');
    const { startListeningForArea } = await import('../src/maps/draw');

    const onAreaUpdate = vi.fn();
    const polygonCoords = [
      [-83.0, 42.0],
      [-83.001, 42.001],
      [-83.002, 42.0],
      [-83.0, 42.0],
    ];

    mockDraw.getSnapshot.mockReturnValue([
      {
        id: 'poly-1',
        geometry: {
          type: 'Polygon',
          coordinates: [polygonCoords],
        },
        properties: { mode: 'polygon' },
      },
    ]);

    startListeningForArea(mockDraw, 'medium', onAreaUpdate);

    if (finishCallback) finishCallback('poly-1', { action: 'draw', mode: 'polygon' });

    // updateField should be called with ('sqft', '1206')
    expect(updateField).toHaveBeenCalledWith('sqft', '1206');
  });
});

describe('handleDoneDrawing', () => {
  let mockDraw: any;

  beforeEach(() => {
    vi.resetModules();

    mockDraw = {
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      getSnapshot: vi.fn(),
      setMode: vi.fn(),
      removeFeatures: vi.fn(),
      addFeatures: vi.fn(),
    };

    (window as any).google = {
      maps: { geometry: { spherical: { computeArea: vi.fn() } } },
    };
  });

  it('removes in-progress feature and adds closed polygon, returns ring coords', async () => {
    const { handleDoneDrawing } = await import('../src/maps/draw');

    const vertices = [
      [-83.0, 42.0],
      [-83.001, 42.001],
      [-83.002, 42.0],
    ];
    const ghostPoint = [-83.003, 42.002]; // cursor position — should be removed

    mockDraw.getSnapshot.mockReturnValue([
      {
        id: 'in-progress-1',
        geometry: {
          type: 'Polygon',
          coordinates: [[...vertices, ghostPoint]],
        },
        properties: {
          mode: 'polygon',
          currentlyDrawing: true,
        },
      },
    ]);

    const result = handleDoneDrawing(mockDraw);

    // Should remove the in-progress feature
    expect(mockDraw.removeFeatures).toHaveBeenCalledWith(['in-progress-1']);

    // Should add a closed polygon (last vertex = first vertex)
    expect(mockDraw.addFeatures).toHaveBeenCalledOnce();
    const addedFeatures = mockDraw.addFeatures.mock.calls[0][0];
    const closedRing = addedFeatures[0].geometry.coordinates[0];

    // Closed ring: vertices + first vertex repeated
    expect(closedRing).toEqual([...vertices, vertices[0]]);

    // Return value is the closed ring
    expect(result).toEqual([...vertices, vertices[0]]);
  });

  it('returns null when fewer than 3 unique vertices exist', async () => {
    const { handleDoneDrawing } = await import('../src/maps/draw');

    mockDraw.getSnapshot.mockReturnValue([
      {
        id: 'in-progress-1',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-83.0, 42.0], [-83.001, 42.001]]], // only 2 vertices + no ghost
        },
        properties: {
          mode: 'polygon',
          currentlyDrawing: true,
        },
      },
    ]);

    const result = handleDoneDrawing(mockDraw);
    expect(result).toBeNull();
  });
});

describe('handleClearPolygon', () => {
  let mockDraw: any;

  beforeEach(() => {
    vi.resetModules();

    mockDraw = {
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      getSnapshot: vi.fn(),
      setMode: vi.fn(),
      removeFeatures: vi.fn(),
      addFeatures: vi.fn(),
    };

    (window as any).google = {
      maps: { geometry: { spherical: { computeArea: vi.fn() } } },
    };
  });

  it('removes all polygon features and calls draw.setMode("polygon") to restart', async () => {
    const { handleClearPolygon } = await import('../src/maps/draw');

    mockDraw.getSnapshot.mockReturnValue([
      {
        id: 'poly-1',
        geometry: { type: 'Polygon', coordinates: [[[-83.0, 42.0]]] },
        properties: { mode: 'polygon' },
      },
      {
        id: 'poly-2',
        geometry: { type: 'Point', coordinates: [-83.0, 42.0] },
        properties: { mode: 'polygon' }, // mode=polygon even for point markers
      },
    ]);

    handleClearPolygon(mockDraw);

    expect(mockDraw.removeFeatures).toHaveBeenCalledWith(['poly-1', 'poly-2']);
    expect(mockDraw.setMode).toHaveBeenCalledWith('polygon');
  });
});
