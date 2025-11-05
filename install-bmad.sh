#!/bin/bash
# BMAD-METHOD Installation Script
# This script automates the BMAD installation process

echo "🚀 Starting BMAD-METHOD installation..."

cd "$(dirname "$0")"

# Use expect to handle interactive prompts
expect << 'EOF'
set timeout 300
spawn npx bmad-method@alpha install

# Handle installation directory prompt - accept default
expect {
    "Installation directory:" {
        send "\r"
        exp_continue
    }
    "Would you like to create it?" {
        send "y\r"
        exp_continue
    }
    "Select modules" {
        # Select all modules (BMM, BMB, CIS)
        send "a\r"
        exp_continue
    }
    "Select" {
        send "\r"
        exp_continue
    }
    "Enter" {
        send "\r"
        exp_continue
    }
    "Your name" {
        send "\r"
        exp_continue
    }
    "Language" {
        send "\r"
        exp_continue
    }
    "IDE" {
        send "\r"
        exp_continue
    }
    "Continue" {
        send "\r"
        exp_continue
    }
    "Complete" {
        send "\r"
        exp_continue
    }
    timeout {
        puts "Installation timed out or completed"
        exit 0
    }
    eof {
        puts "Installation completed"
        exit 0
    }
}
EOF

echo ""
echo "✅ BMAD-METHOD installation complete!"
echo "📁 Check the 'bmad/' directory for installed modules"

