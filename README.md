# GitHub Desktop +

> [The story behind GitHub Desktop +](https://github.com/desktop/desktop/issues/22088)

A fork of [GitHub Desktop](https://desktop.github.com/) that adds a
**favourites sidebar** for one-click switching between the repositories you
spend most of your time in, organised into named groups (e.g. Work, Personal,
OSS). The sidebar is hidden by default and reveals itself the first time you
favourite a repository, so users who don't want it never see it.

<img
  width="1072"
  src="https://github.com/Kosikowski/desktop/raw/pr-assets/docs/favorites-pr/sidebar.png"
  alt="GitHub Desktop + showing the favourites sidebar with two groups and a hover tooltip on a repository"
/>

## How it differs from the official app

This build installs alongside the official GitHub Desktop rather than
replacing it — different bundle id, different product name, different per-user
data folder — so you can run both side by side.

| Platform | Where it lands                                       |
| -------- | ---------------------------------------------------- |
| macOS    | `/Applications/GitHub Desktop +.app`, data in `~/Library/Application Support/GitHub Desktop +/` |
| Windows  | `%LocalAppData%\GitHubDesktopPlus\`, separate "Add/Remove Programs" entry |

- Bundle id: `com.kosikowski.github.GitHubClient`
- Windows identifier: `GitHubDesktopPlus`
- Product name: `GitHub Desktop +`

One Windows caveat: custom URL protocols (`x-github-client://` etc.) are
registered system-wide on a last-writer-wins basis, so if both apps are
installed, whichever you ran most recently catches GitHub sign-in deep links.

## Staying current with upstream

This fork tracks [desktop/desktop](https://github.com/desktop/desktop) stable
releases. A scheduled workflow runs every Monday and opens a draft pull
request whenever upstream ships a new non-prerelease, so the fork-specific
changes (favourites sidebar, rebrand) sit on top of the latest official
release rather than drifting behind.

## Building from source

### Prerequisites

| Tool   | Version |
| ------ | ------- |
| Node   | 20.17   |
| Yarn   | 1.21.1  |
| Python | 3.9.x   |

Platform-specific setup guides live under `docs/contributing/`:

- [macOS](./docs/contributing/setup-macos.md)
- [Windows](./docs/contributing/setup-windows.md)
- [Linux](./docs/contributing/setup-linux.md)
- [ARM64](./docs/contributing/building-arm64.md)

### Quick start (development build)

```sh
git clone https://github.com/Kosikowski/desktop.git
cd desktop
yarn                # install dependencies
yarn build:dev      # compile a development build
yarn start          # launch the app; changes hot-reload (Ctrl/Cmd+Alt+R to reload UI)
```

If you change anything under `app/src/main-process/` you'll need to re-run
`yarn build:dev` before `yarn start` picks it up.

### Production build + installer

```sh
yarn build:prod
yarn package        # writes the platform installer/zip under dist/
```

Outputs:

- **macOS**: `dist/GitHub Desktop +-<arch>.zip`
- **Windows**: `dist/installer/GitHubDesktopPlusSetup-<arch>.{msi,exe}`

The macOS build is **unsigned**, so Gatekeeper will refuse it on first launch
— right-click the `.app` and choose **Open** once to dismiss the warning.

### Running tests and linters

```sh
yarn test           # unit tests (alias for yarn test:unit)
yarn test <path>    # narrow to a file or directory
yarn lint           # prettier + eslint
```

## License

**[MIT](LICENSE)** — inherited from the upstream project.

The MIT license grant does not cover GitHub's trademarks (logos, the
Invertocat mark, the "GitHub" name). When packaging or redistributing this
build, follow the GitHub [logo guidelines](https://github.com/logos).
