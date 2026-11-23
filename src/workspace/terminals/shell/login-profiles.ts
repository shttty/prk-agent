export const LOGIN_PROFILES = String.raw`
if [[ -r /etc/profile ]]; then source /etc/profile; fi
if [[ -r ~/.bash_profile ]]; then source ~/.bash_profile
elif [[ -r ~/.bash_login ]]; then source ~/.bash_login
elif [[ -r ~/.profile ]]; then source ~/.profile
fi
`;
