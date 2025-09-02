<div align="center">
<h1>Clash of Titans</h1>
<h3>An AI-powered grand strategy game engine for historical simulations.</h3>
<p class="tagline">
Originally based on the <a href="https://github.com/neural-maze/philoagents-course">PhiloAgents Course</a> by <a href="https://theneuralmaze.substack.com/">The Neural Maze</a> and <a href="https://decodingml.substack.com">Decoding ML</a>.
</br>
Powered by <a href="https://rebrand.ly/philoagents-mongodb">MongoDB</a>, <a href="https://rebrand.ly/philoagents-opik">Opik</a>, and <a href="https://rebrand.ly/philoagents-groq">Groq</a>.
</p>
</div>
</br>
<p align="center">
<img src="static/diagrams/system_architecture.png" alt="Architecture" width="600">
</p>

## 📖 About This Project

Have you ever wanted to change the course of history? Clash of Titans is a sophisticated, open-source engine for building and playing turn-based historical simulations, powered by a multi-agent AI system.
This project transforms the original PhiloAgents framework into a dynamic grand strategy game. Instead of just chatting with historical figures, you become one. You will navigate a high-stakes crisis, competing against other AI-powered characters, each with their own secret goals and personalities. The entire simulation is refereed by an autonomous AI Judge, who secretly guides the narrative based on a hidden "Undergame" that players must deduce to truly win.

### Key Features:
- Become a Historical Figure: Embody characters like Hannibal Barca or Talleyrand, with unique attributes, resources, and goals.
- Turn-Based Strategy: Participate in game rounds, engaging in private diplomacy and submitting strategic actions.
- Autonomous AI Opponents: Compete against intelligent AI agents that reason, strategize, and form alliances based on their personalities.
- The AI Judge & The Undergame: The world is controlled by an AI narrator with a secret agenda. Its interventions create a deep layer of mystery and deduction.
- Dynamic Scenarios: The engine is fully adaptable. Create your own historical settings, characters, and Undergames simply by editing configuration files.

### 🎮 The "Clash of Titans" Experience
The scenario places you in the Second Punic War in the aftermath of Cannae. As Hannibal, Scipio, or other key figures, you will decide the fate of the Mediterranean. Will you conquer Rome, sabotage your rivals from within, or discover the true, hidden force manipulating the conflict?

### 🏗️ Project Structure
The project is a modular monolith, separating the backend engine from the frontend game client.
code
```bash
.
├── philoagents-api/     # The backend simulation engine (Python, FastAPI, LangGraph)
├── philoagents-ui/      # The frontend game client (JavaScript, Phaser.js)
└── scenarios/          # Directory containing all scenario packs (JSON files)
```
The core logic resides in philoagents-api. The scenarios directory allows you to define new games without changing the core code.
### 📚 Datasets
To ground the AI agents in historical reality, their long-term memory is populated with data from:
- Wikipedia
- Encyclopedia Britannica

The data is scraped automatically based on the configuration in the active scenario pack's rag_sources.json file.
### 🚀 Getting Started
Find detailed setup and usage instructions in the INSTALL_AND_USAGE.md file. This will guide you through setting up the environment, running a scenario, and interacting with the game.
### 💡 Questions and Troubleshooting
Have questions or running into issues? Open a GitHub issue for:
- Questions about the architecture
- Technical troubleshooting
- Clarification on game mechanics
### 🥂 Contributing
This project thrives on community contributions. If you find a bug, have an idea for a new feature, or want to create your own scenario pack to share, we welcome your input!
- Fork the repository.
- Make your changes.
- Create a pull request.

📍 For more details, see the contributing guide.
## 🙏 Acknowledgements & Original Credits
This project would not exist without the incredible foundation provided by the PhiloAgents Open-Source Course. All credit for the original architecture, code, and educational materials goes to:
- Paul Iusztin of Decoding ML
- Miguel Otero Pedrido of The Neural Maze

## License

This project is licensed under the MIT License - see the LICENSE file for details.