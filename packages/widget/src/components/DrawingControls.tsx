import { h } from 'preact';
import { drawingSqft, isDrawingActive, hasFinishedPolygon } from '../state/map';

interface Props {
  pitchLabel: string;
  onStartDrawing: () => void;
  onDoneDrawing: () => void;
  onUseArea: () => void;
  onClear: () => void;
}

export function DrawingControls({ pitchLabel, onStartDrawing, onDoneDrawing, onUseArea, onClear }: Props) {
  const isDrawing = isDrawingActive.value;
  const hasPolygon = hasFinishedPolygon.value;

  return (
    <div class="rc-drawing-controls">
      {isDrawing && drawingSqft.value > 0 && (
        <div class="rc-sqft-live">
          ~{drawingSqft.value.toLocaleString()} sq ft ({pitchLabel} pitch)
        </div>
      )}
      {!isDrawing && !hasPolygon && (
        <button class="rc-btn-primary" onClick={onStartDrawing}>
          Start Drawing
        </button>
      )}
      {isDrawing && (
        <button class="rc-btn-secondary" onClick={onDoneDrawing}>
          Done Drawing
        </button>
      )}
      {hasPolygon && (
        <button class="rc-btn-primary" onClick={onUseArea}>
          Use This Measurement
        </button>
      )}
      {(isDrawing || hasPolygon) && (
        <button class="rc-btn-tertiary" onClick={onClear}>
          Clear &amp; Redraw
        </button>
      )}
    </div>
  );
}
