FROM inert/laravel-app
USER root
RUN apt-get update && apt-get install -y supervisor && rm -rf /var/lib/apt/lists/*
COPY supervisord.conf /etc/supervisor/supervisord.conf
CMD ["/usr/bin/supervisord","-c","/etc/supervisor/supervisord.conf"]
