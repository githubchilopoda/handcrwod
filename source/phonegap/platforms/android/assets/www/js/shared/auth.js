angular.module('app.auth', [])

.constant('AUTH_EVENTS', {
    loginSuccess: 'auth-login-success',
    loginFailed: 'auth-login-failed',
    logoutSuccess: 'auth-logout-success',
    sessionTimeout: 'auth-session-timeout',
    notAuthenticated: 'auth-not-authenticated',
    notAuthorized: 'auth-not-authorized'
})

.constant('USER_ROLES', {
    all: '*',
    user: 'user'
})

.service('$session', 
    function($rootScope, $http, CONFIG, logger, $location) {
        var SESSION = 'session';
        var STATES = 'states';
        var $this = this;
        this.session_id = null;
        this.user_id = null;
        this.planconfig = null;
        this.fromStorage = function() {
            var encoded, err, error, s;
            try {
                encoded = localStorage.getItem(SESSION);
                s = JSON.parse(sjcl.decrypt("hc2015", encoded) || {});
                if (s.session_id == undefined) {
                    s.session_id = null;
                }
                if (s.user_id == undefined) {
                    s.user_id = null;
                }
                if (s.planconfig == undefined) {
                    s.planconfig = null;
                }
            } catch (error) {
                err = error;
                s = {
                    session_id: null
                };
            }
            return s;
        };
        this.statesFromStorage = function() {
            try {
                states = JSON.parse(localStorage.getItem(STATES) || {});

                $rootScope.device_token = states.device_token;
                return states;
            } catch (err) {
                return {};
            }
        };
        this.statesToStorage = function() {
            var err, error;
            try {
                return localStorage.setItem(STATES, JSON.stringify({
                    lastPath: $rootScope.lastPath,
                    cur_home: $rootScope.cur_home,
                    cur_mission: $rootScope.cur_mission,
                    device_token: $rootScope.device_token
                }));
            } catch (error) {
                err = error;
            }
        };
        $rootScope.$on('select-mission', function() {
            return $this.statesToStorage();
        });
        $rootScope.$on('refresh-task-date', function() {
            return $this.statesToStorage();
        });
        $rootScope.$on('refresh-task-date', function() {
            return $this.statesToStorage();
        });
        $rootScope.$on('search-task', function() {
            return $this.statesToStorage();
        });
        $rootScope.$on('select-member', function() {
            return $this.statesToStorage();
        });
        this.saveStates = function(path) {
            $rootScope.lastPath = path;
            return $this.statesToStorage();
        };
        this.create = function(data) {
            var encoded, err, error;
            this.session_id = data.session_id;
            this.user_id = data.user_id;
            this.user_role = 'user';
            this.user_name = data.user_name;
            this.email = data.email;
            this.avartar = data.avartar;
            this.language = data.language;
            this.time_zone = data.time_zone;
            this.states = {};
            this.planconfig = data.plan;
            $rootScope.cur_home = data.cur_home;
            $rootScope.alerts = data.alerts;
            $rootScope.chat_uri = data.chat_uri;
            this.setCurHome(data.cur_home, false);
            this.setCurMission(data.cur_mission, false);
            this.statesToStorage();
            try {
                encoded = sjcl.encrypt("hc2015", JSON.stringify({
                    session_id: this.session_id,
                    user_id: this.user_id
                }));
                return localStorage.setItem(SESSION, encoded);
            } catch (error) {
                err = error;
            }
        };
        this.destroy = function() {
            var err, error;
            this.session_id = null;
            this.user_id = null;
            this.user_role = null;
            this.user_name = null;
            this.email = null;
            this.avartar = null;
            this.language = null;
            this.time_zone = null;
            this.states = null;
            this.planconfig = null;
            this.setCurHome(null);
            this.setCurMission(null);
            $rootScope.homes = null;
            $rootScope.missions = null;
            $rootScope.tasks = null;
            try {
                localStorage.setItem(SESSION, null);
                localStorage.setItem(STATES, null);
            } catch (error) {
                err = error;
            }
        };
        this.getTOKEN = function() {
            if (this.user_id == undefined || this.session_id == undefined || this.user_id == null || this.session_id == null) {
                return '';
            }
            return this.user_id + ":" + this.session_id;
        };

        this.setCurHome = function(home, toStorage) {
            var new_home_id, old_home_id;
            if (toStorage == undefined) {
                toStorage = true;
            }
            old_home_id = null;
            new_home_id = null;
            if ($rootScope.cur_home == undefined) {
                $rootScope.cur_home = null;
            }
            if ($rootScope.cur_home != null) {
                old_home_id = $rootScope.cur_home.home_id;
            }
            if (home != null && home.home_id != null) {
                new_home_id = home.home_id;
            }
            $rootScope.cur_home = home;
            if (toStorage) {
                $this.statesToStorage();
            }
            if (old_home_id != new_home_id) {
                $rootScope.$broadcast('select-home');
            }
        };
        this.setCurMission = function(mission, toStorage) {
            if (toStorage == undefined) {
                toStorage = true;
            }
            $rootScope.cur_mission = mission;
            if (toStorage) {
                $this.statesToStorage();
            }
        };
        return this;
    }
)

.factory('$auth', 
    function($api, $session, $rootScope, $location, $state, $http, AUTH_EVENTS, CONFIG, logger) {
        var authService;
        authService = {};
        authService.autoLogin = function(session_id, authorizedRoles, event, onLoginSuccess) {
            var cur_home_id, path, session, states, token;
            console.log("Try auto login");
            session = $session.fromStorage();
            states = $session.statesFromStorage();
            if (session_id == null) {
                session_id = session.session_id;
            } else if (session_id != session.session_id) {
                states.cur_mission = null;
                states.lastPath = null;
                states.cur_home = null;
            }
            if (session_id != null) {
                path = $location.path();
                token = session.user_id + ":" + session_id;
                cur_home_id = states.cur_home != null ? states.cur_home.home_id : null;
                $api.call('user/get_profile', {
                    TOKEN: token,
                    'cur_home_id': cur_home_id
                }).success(function(data, status, headers, config) {
                    if (data.err_code == 0) {
                        $session.create({
                            session_id: session_id,
                            user_id: data.user.user_id,
                            user_role: 'user',
                            user_name: data.user.user_name,
                            email: data.user.email,
                            avartar: data.user.avartar,
                            language: data.user.language,
                            time_zone: data.user.time_zone,
                            plan: data.user.plan,
                            cur_home: states.cur_home !== null ? states.cur_home : null,
                            cur_mission: states.cur_mission != null ? states.cur_mission : null,
                            alerts: data.user.alerts,
                            chat_uri: data.user.chat_uri
                        });

                        $rootScope.$broadcast('reload_session');

                        console.log("Auto login OK!");
                        if (onLoginSuccess)
                            onLoginSuccess();

                        if (path.indexOf('/signin') == 0) {
                            $state.transitionTo("tab.chats");
                        } else {
                            $location.path(path);
                        }
                    } else {
                        return authService.checkAuth(authorizedRoles, event);
                    }
                }).error(function(data, status, headers, config) {
                    logger.logError('サーバーへ接続することができません。');
                    return authService.checkAuth(authorizedRoles, event);
                });
            } else {
                authService.checkAuth(authorizedRoles, event);
            }
        };
        authService.checkAuth = function(authorizedRoles, event) {
            if (!authService.isAuthorized(authorizedRoles)) {
                if (event != null) {
                    event.preventDefault();
                }
                $state.transitionTo("signin");
            }
            if (authService.isAuthenticated()) {
                return $rootScope.$broadcast(AUTH_EVENTS.notAuthorized);
            } else {
                return $rootScope.$broadcast(AUTH_EVENTS.notAuthenticated);
            }
        };
        authService.login = function(credentials) {
            return $api.call('user/signin', credentials).then(function(res) {
                if (res.data.err_code == 0) {
                    $session.create(res.data);
                }
                return res.data.err_code;
            });
        };
        authService.activate = function(credentials) {
            return $api.call('user/activate', credentials).then(function(res) {
                if (res.data.err_code == 0) {
                    $session.create(res.data);
                }
                return res.data;
            });
        };
        authService.loginFacebook = function(token) {
            return $api.call('facebook/signin', {
                token: token
            }).then(function(res) {
                if (res.data.err_code == 0) {
                    $session.create(res.data);
                }
                return res.data.err_code;
            });
        };
        authService.loginGoogle = function(token) {
            return $api.call('google/signin', {
                token: token
            }).then(function(res) {
                if (res.data.err_code == 0) {
                    $session.create(res.data);
                }
                return res.data.err_code;
            });
        };
        authService.logout = function() {
            return $api.call('user/signout').then(function(res) {
                $session.destroy();
                return $rootScope.$broadcast('closed_session');
            });
        };
        authService.isAuthenticated = function() {
            return !!$session.user_id;
        };
        authService.isAuthorized = function(authorizedRoles) {
            if (!angular.isArray(authorizedRoles)) {
                authorizedRoles = [authorizedRoles];
            }
            return authService.isAuthenticated() && authorizedRoles.indexOf($session.user_role) != -1;
        };
        return authService;
    }
);