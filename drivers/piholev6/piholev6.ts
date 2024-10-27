export class PiHoleConnection {
    private base_url: string;
    private api_password: string;
    private session_id: string | null = null;
    private session_expiry_timestamp: number = 0;

    private static readonly ENDPOINT_AUTH: string = "/api/auth";
    private static readonly ENDPOINT_DNS_BLOCKING: string = "/api/dns/blocking";
    private static readonly ENDPOINT_SUMMARY: string = "/api/stats/summary";
    private static readonly ENDPOINT_PADD: string = "/api/padd";
    private static readonly ENDPOINT_RESTART_DNS: string = "/api/action/restartdns";
    private static readonly ENDPOINT_UPDATE_GRAVITY: string = "/api/action/gravity";
    private static readonly ENDPOINT_FTL_INFO: string = "/api/info/ftl";
    private static readonly ENDPOINT_LOGIN_INFO: string = "/api/info/login";
    private static readonly ENDPOINT_SYSTEM_INFO: string = "/api/info/system";
    private static readonly ENDPOINT_SENSORS: string = "/api/info/sensors";

    constructor(base_url: string, api_password: string) {
        this.base_url = base_url;
        this.api_password = api_password;
    }

    public static async isPiHoleHost(base_url: string, timeout: number = 5_000): Promise<boolean> {
        return fetch(
            PiHoleConnection.createEndpointUrl(base_url, PiHoleConnection.ENDPOINT_LOGIN_INFO),
            {
                signal: AbortSignal.timeout(timeout),
            }
        )
            .then(data => data.json())
            .then((json: any) => json.dns != undefined)
            .catch(error => {
                return false
            });
    }

    public async hasValidBaseUrl(): Promise<boolean> {
        return PiHoleConnection.isPiHoleHost(this.base_url)
    }

    public async hasValidPassword(): Promise<boolean> {
        try {
            await this.updateSessionIdIfNeeded()
            return this.session_id != null;
        } catch (e) {
            console.log("Invalid password: " + e)
            return false;
        }
    }

    public async getAllInfo(): Promise<Pihole6PaddResponse> {
        return this.httpGet(PiHoleConnection.ENDPOINT_PADD, true);
    }


    public async getRecentQueries(historySeconds: number = 60, limit: number = 100): Promise<Pihole6QueryListResponse> {
        return this.getQueries(this.timestamp() - historySeconds, this.timestamp(), limit);
    }

    public async getQueries(startTime: number = this.timestamp() - 30, endTime: number = this.timestamp(), limit: number = 100): Promise<Pihole6QueryListResponse> {
        return this.httpGet(PiHoleConnection.ENDPOINT_PADD, true, {
            from: startTime,
            until: endTime,
            limit: limit
        });
    }

    public async restartDns() {
        return this.httpPost(PiHoleConnection.ENDPOINT_RESTART_DNS, true)
    }

    public async updateGravity() {
        return this.httpPost(PiHoleConnection.ENDPOINT_UPDATE_GRAVITY, true)
    }

    public async getBlockingState(): Promise<PiHoleBlockingState> {
        return this.httpGet(PiHoleConnection.ENDPOINT_DNS_BLOCKING, true);
    }

    /**
     * Set the blocking state
     * @param enableAdBlocking Whether PiHole should filter requests, true to enable blocking/filtering.
     * @param timerSeconds An optional timer, defining how long this blocking state should be set, in seconds.
     */
    public async setBlockingState(enableAdBlocking: boolean, timerSeconds: number | null = null): Promise<PiHoleBlockingState> {
        return this.httpPost(PiHoleConnection.ENDPOINT_DNS_BLOCKING, true, {
            blocking: enableAdBlocking,
            timer: timerSeconds
        });
    }

    private timestamp() {
        return Math.floor(+new Date() / 1000);
    }

    private async httpGet(endpoint: string, authenticate: boolean, queryParameters: any = {}): Promise<any> {
        let url = PiHoleConnection.createEndpointUrl(this.base_url, endpoint, queryParameters)
        let options: RequestInit = {};
        if (authenticate) {
            await this.updateSessionIdIfNeeded();
            options = {
                // @ts-ignore
                headers: {
                    "sid": this.session_id
                }
            }
        }
        return fetch(url, options)
            .then(data => data.json()
                .then((json: any) => {
                    console.log(json);
                    if (Object.keys(json).includes('error')) {
                        throw new Error(json.error.message);
                    }
                    return json
                })
            )
            .catch(error => {
                console.log("Error while fetching information from PiHole: " + error)
                throw error
            });
    }

    private async httpPost(endpoint: string, authenticate: boolean, body: any = {}): Promise<any> {
        let url = PiHoleConnection.createEndpointUrl(this.base_url, endpoint)
        let options: RequestInit = {method: "POST", body: JSON.stringify(body),};
        if (authenticate) {
            await this.updateSessionIdIfNeeded();
            options = {
                method: "POST",
                body: JSON.stringify(body),
                // @ts-ignore
                headers: {
                    sid: this.session_id
                }
            }
        }
        return fetch(url, options)
            .then(data => data.json())
            .catch(error => {
                console.log("Error while fetching information from PiHole through POST request: " + error)
                throw error
            });
    }

    private static createEndpointUrl(base_url: string, endpoint: string, queryParameters: any = {}) {
        return base_url + endpoint + this.objectToQueryString(queryParameters);
    }

    private static objectToQueryString(obj: any): string {
        if (Object.keys(obj).length === 0) {
            return ""
        }
        return "?" + Object.keys(obj)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
            .join('&');
    }

    private async updateSessionIdIfNeeded() {
        // Keep a 60 second margin on expiry, we rather refresh once too often than to leave this method with an expired session id.
        if (this.session_id != null && this.session_expiry_timestamp - 60 >= this.timestamp()) {
            return // nothing to do, session token still valid
        }
        // don't use the authenticate parameter, since that would call this method again.
        try {
            let sessionResponse: Pihole6SessionResponse = await this.httpPost(PiHoleConnection.ENDPOINT_AUTH, false, {
                password: this.api_password
            })
            console.log(JSON.stringify(sessionResponse));
            if (!Object.keys(sessionResponse).includes("session")) {
                throw new Error("Invalid base url")
            }
            if (!sessionResponse.session.valid) {
                throw new Error("Invalid API password")
            }
            this.session_id = sessionResponse.session.sid
            // convert TTL to absolute timestamp
            this.session_expiry_timestamp = this.timestamp() + sessionResponse.session.validity
        } catch (e) {
            throw new Error("Invalid base url or API password: " + e)
        }
    }
}

type Pihole6SessionResponse = {
    session: {
        valid: boolean; // Valid session indicator (client is authenticated)
        totp: boolean; // Whether 2FA (TOTP) is enabled on this Pi-hole
        sid: string | null; // Session ID
        csrf: string | null; // CSRF token
        validity: number; // Remaining lifetime of this session unless refreshed (seconds)
        message: string | null; // Human-readable message describing the session status
    }
};

type Pihole6Session = {
    valid: boolean; // Valid session indicator (client is authenticated)
    totp: boolean; // Whether 2FA (TOTP) is enabled on this Pi-hole
    sid: string | null; // Session ID
    csrf: string | null; // CSRF token
    validity: number; // Remaining lifetime of this session unless refreshed (seconds)
    message: string | null; // Human-readable message describing the session status
}
type Pihole6QueryListResponse = {
    queries: [{ // Data array
        id: number // Query ID in the long-term database
        time: number // Timestamp
        type: string // Query type
        domain: string // Queried domain
        cname: string | null // Domain blocked during deep CNAME inspection
        status: string | null // Query status
        client: {
            ip: string // Requesting client's IP address
            name: string | null // Requesting client's base_urlname (if available)
        }
        dnssec: string | null // DNSSEC status
        reply: {
            type: string | null // Reply type
            time: number // Time until the response was received (ms, negative if N/A)
        }
        list_id: number | null // ID of corresponding database table (adlist for anti-/gravity, else domainlist) (NULL if N/A)
        upstream: string | null // IP or name + port of upstream server
    }]
    cursor: number // Database ID of most recent query to show
    recordsTotal: number // Total number of available queries
    recordsFiltered: number // Number of available queries after filtering
    draw: number // DataTables-specific integer (echos input value)
    took: number // Time in seconds it took to process the request
}

type Pihole6FtlInfoResponse = {
    ftl: {
        database: {
            gravity: number;
            groups: number;
            lists: number;
            clients: number;
            domains: {
                allowed: number;
                denied: number;
            },
            regex: {
                allowed: number;
                denied: number;
            }
        },
        privacy_level: number;
        query_frequency: number;
        clients: {
            total: number;
            active: number;
        },
        pid: number;
        uptime: number;
        "%mem": number;
        "%cpu": number;
        allow_destructive: boolean;
        dnsmasq: {
            dns_cache_inserted: number;
            dns_cache_live_freed: number;
            dns_queries_forwarded: number;
            dns_auth_answered: number;
            dns_local_answered: number;
            dns_stale_answered: number;
            dns_unanswered: number;
            bootp: number;
            pxe: number;
            dhcp_ack: number;
            dhcp_decline: number;
            dhcp_discover: number;
            dhcp_inform: number;
            dhcp_nak: number;
            dhcp_offer: number;
            dhcp_release: number;
            dhcp_request: number;
            noanswer: number;
            leases_allocated_4: number;
            leases_pruned_4: number;
            leases_allocated_6: number;
            leases_pruned_6: number;
            tcp_connections: number;
            dnssec_max_crypto_use: number;
            dnssec_max_sig_fail: number;
            dnssec_max_work: number;
        }
    };
    took: number;
}

type Pihole6SystemInfoResponse = {
    system: {
        uptime: number;
        memory: {
            ram: {
                total: number;
                free: number;
                used: number;
                available: number;
                '%used': number;
            };
            swap: {
                total: number;
                free: number;
                used: number;
                '%used': number;
            };
        };
        procs: number;
        cpu: {
            nprocs: number;
            load: {
                raw: number[];
                percent: number[];
            };
        };
    };
    took: number;
};

type Pihole6VersionInfoResponse = {
    version: {
        core: {
            local: {
                branch: string | null;
                version: string | null;
                hash: string | null;
            };
            remote: {
                version: string | null;
                hash: string | null;
            };
        };
        web: {
            local: {
                branch: string | null;
                version: string | null;
                hash: string | null;
            };
            remote: {
                version: string | null;
                hash: string | null;
            };
        };
        ftl: {
            local: {
                branch: string | null;
                version: string | null;
                hash: string | null;
                date: string | null;
            };
            remote: {
                version: string | null;
                hash: string | null;
            };
        };
        docker: {
            local: string | null;
            remote: string | null;
        };
    };
    took: number;
};

type Pihole6PaddResponse = {
    recent_blocked: string | null;
    top_domain: string | null;
    top_blocked: string | null;
    top_client: string | null;
    active_clients: number;
    gravity_size: number;
    blocking: BlockingStatus;
    queries: {
        total: number;
        blocked: number;
        percent_blocked: number;
    };
    cache: {
        size: number;
        inserted: number;
        evicted: number;
    };
    iface: {
        v4: {
            addr: string | null;
            rx_bytes: {
                value: number;
                unit: string;
            };
            tx_bytes: {
                value: number;
                unit: string;
            };
            num_addrs: number;
            name: string;
            gw_addr: string | null;
        };
        v6: {
            addr: string | null;
            num_addrs: number;
            name: string;
            gw_addr: string | null;
        };
    };
    node_name: string;
    base_url_model: string | null;
    config: {
        dhcp_active: boolean;
        dhcp_start: string;
        dhcp_end: string;
        dhcp_ipv6: boolean;
        dns_domain: string;
        dns_port: number;
        dns_num_upstreams: number;
        dns_dnssec: boolean;
        dns_revServer_active: boolean;
    };
    '%cpu': number;
    '%mem': number;
    pid: number;
    sensors: {
        cpu_temp: number | null;
        hot_limit: number;
        unit: string;
    };
    system: {
        uptime: number;
        memory: {
            ram: {
                total: number;
                free: number;
                used: number;
                available: number;
                '%used': number;
            };
            swap: {
                total: number;
                free: number;
                used: number;
                '%used': number;
            };
        };
        procs: number;
        cpu: {
            nprocs: number;
            load: {
                raw: number[];
                percent: number[];
            };
        };
    };
    version: {
        core: {
            local: {
                branch: string | null;
                version: string | null;
                hash: string | null;
            };
            remote: {
                version: string | null;
                hash: string | null;
            };
        };
        web: {
            local: {
                branch: string | null;
                version: string | null;
                hash: string | null;
            };
            remote: {
                version: string | null;
                hash: string | null;
            };
        };
        ftl: {
            local: {
                branch: string | null;
                version: string | null;
                hash: string | null;
                date: string | null;
            };
            remote: {
                version: string | null;
                hash: string | null;
            };
        };
        docker: {
            local: string | null;
            remote: string | null;
        };
    };
    took: number;
};


type Pihole6LoginInfo = {
    dns: boolean,
    https_port: number | undefined
}

export enum BlockingStatus {
    Enabled = "enabled",
    Disabled = "disabled",
    Failed = "failed",
    Unknown = "unknown"
}

type PiHoleBlockingState = {
    blocking: BlockingStatus;
    timer: number | null;
};