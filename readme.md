# Prerequisites

- Needs node-gyp installed and gcc -v >= 5 (for argon2)
- Install nodemon globally (npm -g install nodemon)
- Install webhook (sudo apt-get install webhook)
- Postgresql (version 10.6)


## Nginx conf:

        location /home/ {
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-NginX-Proxy true;
                proxy_pass http://localhost:3001/;
                proxy_ssl_session_reuse off;
                proxy_set_header Host $http_host;
                proxy_cache_bypass $http_upgrade;
                proxy_redirect off;
                allow all;
        }

