FROM node:7.9.0

LABEL maintainer="Brian McCarthy <brian.mcc@rthy.org>"

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install && npm cache clean
COPY . /usr/src/app

EXPOSE 8080

CMD [ "npm", "start" ]
