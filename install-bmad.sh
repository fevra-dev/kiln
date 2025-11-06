#!/bin/bash
# BMAD-METHOD Installation Script
# This script automates the BMAD installation process

echo "🚀 Starting BMAD-METHOD installation..."

cd "$(dirname "$0")"

# Use expect to handle interactive prompts
expect << 'EOF'
set timeout 600
spawn npx bmad-method@alpha install

# Handle all prompts with appropriate responses
expect {
    "Installation directory:" {
        send "\r"
        exp_continue
    }
    "Would you like to create it?" {
        send "y\r"
        exp_continue
    }
    "Install to this directory?" {
        send "Yes\r"
        exp_continue
    }
    "What is your name?" {
        send "Developer\r"
        exp_continue
    }
    "Where do custom agents get created?" {
        send "\r"
        exp_continue
    }
    "Where do custom workflows get stored?" {
        send "\r"
        exp_continue
    }
    "What is the title of your project" {
        send "\r"
        exp_continue
    }
    "Include Game Planning Agents" {
        send "No\r"
        exp_continue
    }
    "What is your technical experience level?" {
        # Select Intermediate (default option)
        send "\r"
        exp_continue
    }
    "Where is Technical Documentation located" {
        send "\r"
        exp_continue
    }
    "Where should development stories be stored" {
        send "\r"
        exp_continue
    }
    "Install user documentation to project directory?" {
        send "Yes\r"
        exp_continue
    }
    "Enable Playwright MCP capabilities" {
        send "N\r"
        exp_continue
    }
    "Select modules" {
        # Select all modules - press space to select, then enter
        send " \r"
        exp_continue
    }
    "Select modules to install" {
        # Select all: BMM, BMB, CIS
        send "a\r"
        exp_continue
    }
    "Choose modules" {
        # Arrow down to select all, then enter
        send "\033[B\r"
        exp_continue
    }
    "Language" {
        send "\r"
        exp_continue
    }
    "Output language" {
        send "\r"
        exp_continue
    }
    "IDE" {
        send "\r"
        exp_continue
    }
    "Select IDE" {
        send "\r"
        exp_continue
    }
    "Continue" {
        send "\r"
        exp_continue
    }
    "Press" {
        send "\r"
        exp_continue
    }
    "Complete" {
        send "\r"
        exp_continue
    }
    "Done" {
        send "\r"
        exp_continue
    }
    "installed" {
        exp_continue
    }
    "Installing" {
        exp_continue
    }
    "Downloading" {
        exp_continue
    }
    "Creating" {
        exp_continue
    }
    timeout {
        puts "\nInstallation process timed out - checking if installation completed..."
        exit 0
    }
    eof {
        puts "\nInstallation process completed!"
        exit 0
    }
}
EOF

echo ""
if [ -d "bmad" ]; then
    echo "✅ BMAD-METHOD installation complete!"
    echo "📁 BMAD directory found at: $(pwd)/bmad"
    echo ""
    echo "📦 Installed modules:"
    ls -la bmad/ 2>/dev/null | head -10
else
    echo "⚠️  BMAD directory not found. Installation may have failed or needs manual completion."
    echo "💡 Try running: npx bmad-method@alpha install"
fi

