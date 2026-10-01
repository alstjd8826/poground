module.exports = function (api) {
  api.cache(true)
  return {
    // babel-preset-expo 가 reanimated/worklets 플러그인을 자동으로 포함한다.
    // (직접 'react-native-worklets/plugin' 을 넣으면 중복 적용되어 경고가 난다)
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            // src 밖이라 @ 로는 못 잡는다. 이미지/폰트도 상대경로 없이 참조하게 별도로 연다
            '@assets': './assets',
          },
        },
      ],
    ],
  }
}
