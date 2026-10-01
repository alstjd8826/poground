const expoPreset = require('jest-expo/jest-preset')

/**
 * jest-expo 의 transformIgnorePatterns 를 그대로 쓰되, ESM 으로 배포되는 패키지만 덧붙인다.
 * 통째로 다시 쓰면 Expo 가 나중에 목록을 바꿔도 따라가지 못한다.
 */
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map(p =>
  p.startsWith('/node_modules/(?!(') ? p.replace('(?!(', '(?!(@shopify/flash-list|') : p,
)

module.exports = {
  // jest-expo 가 Expo/RN 모듈 목킹까지 함께 처리한다
  preset: 'jest-expo',
  transformIgnorePatterns,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
  },
  // supabase/ 는 Deno 런타임에서 `deno task test` 로 돌린다. jest 가 집어가면 안 된다.
  testPathIgnorePatterns: ['/node_modules/', '/supabase/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
}
