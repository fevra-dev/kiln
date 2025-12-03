# BMAD-METHOD Integration Guide

**BMAD-METHOD v6 Alpha has been successfully integrated into the KILN.1 project.**

> **Quick Start Guide** - For KILN-specific patterns and advanced usage, see [BMAD_KILN_INTEGRATION.md](./BMAD_KILN_INTEGRATION.md)

## 📦 What Was Installed

### Core Components
- **BMAD Core** - Foundation framework with BMad Master agent
- **BMAD Method (BMM)** - 8 specialized agents and 34 workflows for agile development
- **BMAD Builder (BMB)** - 1 agent and 7 workflows for building custom solutions

### Installation Location
```
/Users/fevra/Apps/kiln/bmad/
├── core/          # Core framework + BMad Master agent
├── bmm/           # BMad Method (12 agents, 34 workflows)
├── bmb/           # BMad Builder (1 agent, 7 workflows)
└── _cfg/          # Customization files (survives updates)
```

### Installed Agents (BMM)
1. **Analyst** - Domain research and analysis
2. **Architect** - System architecture design
3. **Dev** - Development and implementation
4. **PM** - Project management
5. **SM** - Scrum Master
6. **TEA** - Technical Expert Advisor
7. **Tech Writer** - Technical documentation
8. **UX Designer** - User experience design

### Key Workflows Available

#### Analysis Workflows
- `brainstorm-project` - Project ideation and brainstorming
- `domain-research` - Domain-specific research
- `product-brief` - Product requirements gathering
- `research` - General research workflows

#### Planning Workflows
- `prd` - Product Requirements Document creation
- `tech-spec` - Technical specification development
- `create-ux-design` - UX design workflows
- `narrative` - Narrative and story creation

#### Implementation Workflows
- `dev-story` - Development story implementation
- `create-story` - Story creation
- `code-review` - Code review workflows
- `sprint-planning` - Sprint planning
- `retrospective` - Team retrospectives

#### Solutioning Workflows
- `architecture` - System architecture design
- `solutioning-gate-check` - Solution validation

## 🚀 Getting Started

### Method 1: Load an Agent (Recommended)

1. **Load an agent** in your IDE (Cursor/Claude Code)
2. **Wait for the menu** showing available workflows
3. **Execute workflows** using:
   - Natural language: "Run workflow-init"
   - Shortcut: `*workflow-init`
   - Menu number: "Run option 2"

### Method 2: Direct Slash Commands

Execute workflows directly using slash commands:

```
/bmad:bmm:workflows:workflow-init
/bmad:bmm:workflows:prd
/bmad:bmm:workflows:dev-story
```

### Method 3: Party Mode

Run workflows with multi-agent collaboration:

```
/bmad:core:workflows:party-mode
```

## 📋 Quick Start for KILN.1 Project

### 1. Initialize Project Workflow

First, run the workflow initialization:

```
*workflow-init
```

This will:
- Analyze your KILN.1 project structure
- Set up the appropriate planning track
- Configure workflows for your codebase

### 2. Document Existing Code

Since KILN.1 is a brownfield project, consider:

```
*research              # Research Solana teleburn protocols
*domain-research       # Deep dive into cross-chain migration
*product-brief         # Document current product state
```

### 3. Plan New Features

Use planning workflows for new features:

```
*prd                   # Create Product Requirements Document
*tech-spec            # Create technical specifications
*architecture         # Design system architecture
```

### 4. Implement Features

Use implementation workflows:

```
*dev-story            # Implement development stories
*create-story         # Create new user stories
*code-review          # Review code changes
```

## 🎯 Recommended Workflows for KILN.1

### For Documentation
- `tech-spec` - Document the teleburn algorithm
- `techdoc` - Create technical documentation
- `document-project` - Comprehensive project documentation

### For Development
- `dev-story` - Implement new teleburn features
- `code-review` - Review Solana transaction code
- `create-story` - Plan new teleburn workflows

### For Architecture
- `architecture` - Design system improvements
- `solutioning-gate-check` - Validate solutions

### For Analysis
- `domain-research` - Research Bitcoin Ordinals
- `product-brief` - Document product requirements
- `brainstorm-project` - Generate new ideas

## 🔧 Configuration

### Customization Files

Agent customizations are stored in:
```
bmad/_cfg/agents/
```

These files survive updates and allow you to:
- Customize agent personalities
- Modify expertise areas
- Adjust communication styles
- Add project-specific knowledge

### Project Configuration

BMAD is configured for:
- **Project Title**: kiln
- **Technical Level**: Intermediate
- **Documentation Path**: `docs/`
- **Stories Path**: `docs/stories/`
- **Game Dev**: Disabled (not needed for this project)

## 📚 Documentation

### BMAD Documentation
- Main README: `bmad/bmm/README.md`
- Quick Start: `bmad/bmm/docs/quick-start.md`
- Workflow Guide: `bmad/bmm/docs/workflows-implementation.md`
- Agent Guide: `bmad/bmm/docs/agents-guide.md`

### KILN.1 Documentation
- Continue using existing docs in `docs/`
- BMAD stories will be stored in `docs/stories/`

## 🎨 Integration with KILN.1

### Current Project Structure
BMAD integrates seamlessly with your existing structure:

```
kiln/
├── bmad/              # BMAD framework (NEW)
├── docs/              # Existing documentation
│   └── stories/       # BMAD development stories (NEW)
├── src/               # Your source code
└── tests/             # Your tests
```

### Using BMAD with Existing Code

1. **Load the Architect agent** to analyze your teleburn implementation
2. **Use the Dev agent** to implement new features
3. **Use the Tech Writer** to document your APIs
4. **Use the Analyst** to research new protocols

## 🔄 Workflow Status

BMAD tracks workflow status in:
```
bmad/bmm/workflows/workflow-status/
```

## 💡 Tips

1. **Start with workflow-init** - This analyzes your project and recommends the right track
2. **Use Party Mode** - Get multiple agent perspectives on complex decisions
3. **Customize Agents** - Modify agent files in `bmad/_cfg/agents/` to match your style
4. **Document as You Go** - Use tech-spec and techdoc workflows regularly

## 🐛 Troubleshooting

If you encounter issues:

1. Check `bmad/bmm/docs/troubleshooting.md`
2. Review `bmad/bmm/docs/faq.md`
3. Ensure your IDE is properly configured (Cursor/Claude Code)

## 📝 Next Steps

1. ✅ BMAD installed successfully
2. 🔄 Run `*workflow-init` to set up your project workflow
3. 📚 Review `bmad/bmm/docs/quick-start.md` for detailed guidance
4. 🚀 Start using workflows for your development tasks

---

**Installation Date**: November 5, 2025  
**BMAD Version**: v6.0.0-alpha.6  
**Status**: ✅ Ready to use

