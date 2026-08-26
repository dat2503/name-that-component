# Contributing

Thanks for helping improve Name That Component.

1. Open an issue for substantial changes so the approach can be discussed.
2. Fork the repository and create a focused branch.
3. Keep the extension fully offline and avoid adding broad permissions.
4. Run `powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -ValidateOnly`.
5. Run `node scripts/browser-smoke-test.mjs` when Chrome is installed at its
   standard Windows location.
6. Test the unpacked extension on a plain HTML page and, when relevant, the
   framework or design system changed by your patch.
7. Open a pull request explaining the user-visible behavior and test coverage.

By contributing, you agree that your contribution is licensed under the MIT
License.
