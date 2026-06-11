# Contributing to Clash of Titans

Thanks for your interest in improving this AI-powered grand strategy game engine 👋

Clash of Titans is an open-source engine for turn-based historical simulations, powered by a multi-agent AI system. Contributions of all sizes are welcome.

## Ways to Contribute

A contribution can be:
- Fixing bugs in the game loop, agents, or UI
- Creating new historical scenarios (characters, crises, and Undergames under `philoagents-api/scenarios/`)
- Improving documentation or fixing typos
- Updating dependencies or fixing modules that no longer work
- Adding tests
- Improving support for different operating systems (e.g., Windows)

Remember, no contribution is too small.

## Reporting Issues

Found a problem or have a suggestion? Please create an issue on GitHub, providing as much detail as possible, ideally with steps to reproduce, logs, and your environment (OS, Python version, Docker version).

## Contributing Code or Content

1. **Fork & Branch:** Fork the repo and create a branch from `main`.
2. **Make Changes:** Implement your contribution. See [INSTALL_AND_USAGE.md](INSTALL_AND_USAGE.md) for how to set up your environment.
3. **Test:** Verify your changes work properly by running the game locally (`make infrastructure-up`).
4. **Check Quality:** For backend changes, run `make format-fix` and `make lint-fix` inside `philoagents-api/`.
5. **Commit:** Write clear, concise commit messages.
6. **Stay Updated:** Ensure your branch is updated with `main` before submitting.
7. **Submit PR:** Push to your fork and open a pull request.
8. **Review Process:** Wait for maintainer review.

📍 [Official Guide on creating a pull request from a forked GitHub repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)

## Code Quality and Readability

For high-quality, readable code:
- Write clean, well-structured code that follows the existing layered architecture (domain / application / infrastructure)
- Add helpful comments for complex logic
- Use consistent formatting (`ruff` is configured for the backend)
- Use consistent documentation style

## Acknowledgements

This project was originally based on the [PhiloAgents Course](https://github.com/neural-maze/philoagents-course) by The Neural Maze and Decoding ML.
