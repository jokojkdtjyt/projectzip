import { HeartPulse, Brain, Dna, Activity, Microscope, Droplets } from 'lucide-react';
import React from 'react';

export const ICON_MAP: Record<string, React.ElementType> = {
  heart: HeartPulse,
  brain: Brain,
  dna: Dna,
  lungs: Activity,
  microscope: Microscope,
  droplets: Droplets,
};
