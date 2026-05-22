import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import '@testing-library/jest-dom/vitest';
