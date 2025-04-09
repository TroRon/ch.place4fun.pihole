export class PiHoleConnection {
    private base_url: string;
    private api_password: string;
    public session_id: string | null = null;
    private session_expiry_timestamp: number = 0;

    private static readonly ENDPOINT_AUTH: string = "/api/auth";
    private static readonly ENDPOINT_DNS_BLOCKING: string = "/api/dns/blocking";
    private static readonly ENDPOINT_QUERIES: string = "/api/queries";
    private static readonly ENDPOINT_PADD: string = "/api/padd";
    private static readonly ENDPOINT_RESTART_DNS: string = "/api/action/restartdns";
    private static readonly ENDPOINT_UPDATE_GRAVITY: string = "/api/action/gravity";
    private static readonly ENDPOINT_LOGIN_INFO: string = "/api/info/login";
    private static readonly ENDPOINT_GROUPS: string = "/api/groups";
    private static readonly ENDPOINT_DOMAINS: string = "/api/domains";
    private static readonly ENDPOINT_SEARCH: string = "/api/search";
    private static readonly ENDPOINT_LOCAL_DNS: string = "/api/config/dns/hosts";
    private static readonly ENDPOINT_LOCAL_CNAME: string = "/api/config/dns/cnameRecords";

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
            console.log("PiHoleV6 | Invalid password: " + e)
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
        return this.httpGet(PiHoleConnection.ENDPOINT_QUERIES, true, {
            from: startTime,
            until: endTime,
            limit: limit
        });
    }

    public async restartDns() {
        return this.httpPost(PiHoleConnection.ENDPOINT_RESTART_DNS, true)       
    }

    public async updateGravity() {
        // this endpoint does not return json
        return this.httpRaw(PiHoleConnection.ENDPOINT_UPDATE_GRAVITY, "POST", true, null).then(response => console.log(response.body))
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

    public async addDomain(domainName: string, kind: "exact" | "regex", type: "allow" | "block") {
        let endpoint = PiHoleConnection.ENDPOINT_DOMAINS + "/" + type + "/" + kind;
        return this.httpPost(endpoint, true, {
            domain: domainName,
            comment: "Created by Homey flow",
            enabled: true
        });
    }

    public async removeDomain(domainName: string, kind: "exact" | "regex", type: "allow" | "block"): Promise<void> {
        let endpoint = PiHoleConnection.ENDPOINT_DOMAINS + "/" + type + "/" + kind + "/" + encodeURIComponent(domainName);
        this.httpDelete(endpoint, true);
    }

    public async getDomainDetails(domainName: string, type: "allow" | "block"): Promise<Pihole6Domain[]> {
        let endpoint = PiHoleConnection.ENDPOINT_DOMAINS + "/" + type + "/" + encodeURIComponent(domainName);
        return this.httpGet(endpoint, true).then(json => json.domains);
    }

    public async searchDomain(domainName: string): Promise<Pihole6Domain[]> {
        let endpoint = PiHoleConnection.ENDPOINT_SEARCH + "/" + encodeURIComponent(domainName);
        return this.httpGet(endpoint, true, {partial: false, debug: false})
            .then(json => [].concat(json.search.domains, json.search.gravity.map(this.gravityToDomain)));
    }

    /**
     * Convert a gravity blocklist to a Pihole6Domain object for easier and more consistent handling
     * @param gravityDomain
     * @private
     */
    private gravityToDomain(gravityDomain: any): Pihole6Domain {
        return {
            domain: gravityDomain.domain,
            unicode: gravityDomain.domain,
            comment: gravityDomain.address + ": " + gravityDomain.comment,
            enabled: gravityDomain.enabled,
            type: gravityDomain.type == "allow" ? "allow" : "deny",
            kind: "gravity",
            id: -1 * gravityDomain.id,
            groups: gravityDomain.groups,
            date_added: gravityDomain.date_added,
            date_modified: Math.max(gravityDomain.date_modified, gravityDomain.date_updated),
        }
    }

    /**
     * Add a domain to a group. The domain may not exist more than once
     * @param domainName
     * @param groupId
     * @return True if successful, false if no action was taken.
     */
    public async addDomainToGroup(domainName: string, groupId: number): Promise<boolean> {
        return this.httpGet(PiHoleConnection.ENDPOINT_DOMAINS + "/" + domainName, true)
            .then(
                response => {
                    if (response.domains.length > 1) {
                        throw new Error("Domain " + domainName + " is present more than once in pi-hole. Cannot be added to group.")
                    }
                    return response.domains[0]
                }
            ).then(
                domain => {
                    if (domain.groups.includes(groupId)) {
                        console.log("PiHoleV6 | Domain " + domainName + " already in group " + groupId + ", no action required")
                        return false;
                    }

                    domain.groups.push(groupId)
                    // type: allow/block, kind: exact/regex
                    let endpoint = PiHoleConnection.ENDPOINT_DOMAINS + "/" + domain.type + "/" + domain.kind + "/" + encodeURIComponent(domain.domain);
                    return this.httpPut(endpoint, true, domain)
                        .then(() => true)
                        .catch((error: any) => {
                            throw error
                        })
                }
            )
    }

    /**
     * Remove a domain from a group. The domain may not exist more than once
     * @param domainName
     * @param groupId
     * @return True if successful, false if no action was taken.
     */
    public async removeDomainFromGroup(domainName: string, groupId: number): Promise<boolean> {
        return this.httpGet(PiHoleConnection.ENDPOINT_DOMAINS + "/" + domainName, true)
            .then(
                response => {
                    if (response.domains.length > 1) {
                        throw new Error("Domain " + domainName + " is present more than once in pi-hole. Cannot be removed from group.")
                    }
                    return response.domains[0]
                }
            ).then(
                domain => {
                    if (!domain.groups.includes(groupId)) {
                        console.log("PiHoleV6 | Domain " + domainName + " is not present in group " + groupId + ", no action required")
                        return false;
                    }

                    // remove from array
                    const index = domain.groups.indexOf(groupId);
                    domain.groups.splice(index, 1)

                    // type: allow/block, kind: exact/regex
                    let endpoint = PiHoleConnection.ENDPOINT_DOMAINS + "/" + domain.type + "/" + domain.kind + "/" + encodeURIComponent(domain.domain);
                    return this.httpPut(endpoint, true, domain)
                        .then(() => true)
                        .catch((error: any) => {
                            throw error
                        })
                }
            )
    }

    public async listGroups(): Promise<Pihole6Group[]> {
        return this.httpGet(PiHoleConnection.ENDPOINT_GROUPS, true,).then(json => json.groups)
    }

    public async addLocalDnsRecord(domainName: string, ipAddress: number) {
        return this.httpPut(PiHoleConnection.ENDPOINT_LOCAL_DNS + "/" + encodeURIComponent(ipAddress + " " + domainName), true)
    }

    public async removeLocalDnsRecord(domainName: string, ipAddress: number | null = null) {
        if (!ipAddress) {
            let existingRecords = await this.httpGet(PiHoleConnection.ENDPOINT_LOCAL_DNS,true).then(
                json => json.config.dns.hosts.filter((host: String) => host.endsWith(" " + domainName))
            )
            if (existingRecords.length == 0) {
                throw new Error("No local DNS record found for " + domainName)
            }
            if (existingRecords.length > 1) {
                throw new Error("Multiple local DNS records found for " + domainName)
            }
            ipAddress = existingRecords[0].split(" ")[0]
        }
        return this.httpDelete(PiHoleConnection.ENDPOINT_LOCAL_DNS + "/" + encodeURIComponent(ipAddress + " " + domainName), true)
    }

    private timestamp() {
        return Math.floor(+new Date() / 1000);
    }

    private async httpGet(endpoint: string, authenticate: boolean, queryParameters: any = {}): Promise<any | null> {
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
        //console.log("Zugriffs-URL:" ,url);
        return fetch(url, options)
            .then(PiHoleConnection.parseOptionalJson)
            .then((json: any) => {
                //console.log(JSON.stringify(json));
                if (json != null && Object.keys(json).includes('error')) {
                    throw new Error(json.error.message);
                }
                return json
            })
            .catch(error => {
                console.log("PiHoleV6 | Error while fetching information from PiHole: " + error)
                throw error
            });
    }

    private async httpPost(endpoint: string, authenticate: boolean, body: any = {}): Promise<any | null> {
        return this.httpRaw(endpoint, "POST", authenticate, body)
            .then(PiHoleConnection.parseOptionalJson)
            .then((json: any) => {
                //console.log(json);
                if (json != null && Object.keys(json).includes('error')) {
                    throw new Error(json.error.message);
                }
                return json
            })
    }

    private async httpPut(endpoint: string, authenticate: boolean, body: any = {}): Promise<any | null> {
        return this.httpRaw(endpoint, "PUT", authenticate, body)
            .then(PiHoleConnection.parseOptionalJson)
            .then((json: any) => {
                // console.log(json);
                if (json != null && Object.keys(json).includes('error')) {
                    throw new Error(json.error.message);
                }
                return json
            })
    }


    private async httpDelete(endpoint: string, authenticate: boolean, body: any = {}): Promise<any | null> {
        return this.httpRaw(endpoint, "DELETE", authenticate, body)
            .then(PiHoleConnection.parseOptionalJson)
            .then((json: any) => {
                //console.log(JSON.stringify(json));
                if (json != null && Object.keys(json).includes('error')) {
                    throw new Error(json.error.message);
                }
                return json
            })
    }

    private async httpRaw(endpoint: string, method: string, authenticate: boolean, body: any = {}): Promise<any | null> {
        let url = PiHoleConnection.createEndpointUrl(this.base_url, endpoint)
        let options: RequestInit = {method: method, body: JSON.stringify(body)};
        if (authenticate) {
            await this.updateSessionIdIfNeeded();
            options = {
                method: method,
                body: JSON.stringify(body),
                // @ts-ignore
                headers: {
                    sid: this.session_id
                }
            }
        }
        //console.log(method + " " + url);
        //console.log(JSON.stringify(body));
        return fetch(url, options)
            .catch(error => {
                console.log("PiHoleV6 | Error while fetching information from PiHole through POST request to " + url + ": " + error)
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

    private static async parseOptionalJson(response: Response) {
        const text = await response.text()
        if (text.length == 0) {
            return null;
        }
        try {
            return JSON.parse(text)
        } catch (err) {
            throw new Error("Failed to parse JSON API response: " + text)
        }
    }

    private async updateSessionIdIfNeeded() {
        // Keep a 60 second margin on expiry, we rather refresh once too often than to leave this method with an expired session id.
        if (this.session_id != null && this.session_expiry_timestamp - 60 >= this.timestamp()) {
            return // nothing to do, session token still valid
        }
        // don't use the authenticate parameter, since that would call this method again.
        let sessionResponse = null;
        try {
            let sessionResponse: Pihole6SessionResponse = await this.httpPost(PiHoleConnection.ENDPOINT_AUTH, false, {
                password: this.api_password
            })

            if (!Object.keys(sessionResponse).includes("session")) {
                throw new Error("Invalid base url, is this a PiHole v6 instance?")
            }
            if (!sessionResponse.session.valid) {
                throw new Error("Invalid API password")
            }
            this.session_id = sessionResponse.session.sid
            console.log("PiHoleV6 | Updated session id to " + this.session_id)

            // convert TTL to absolute timestamp
            this.session_expiry_timestamp = this.timestamp() + sessionResponse.session.validity
        } catch (e: any) {
            this.handleDnsResolutionError(e);
            throw new Error("Invalid base url or API password: \n" + e + ", " + e.cause + "\n" + JSON.stringify(sessionResponse))
        }
    }

    private handleDnsResolutionError(e: any) {
        if (e.cause && e.cause.message.includes("getaddrinfo")) {
            // When querying pihole.local, homey seems to query for "local" SOA records, which aren't present in pi-hole.
            // This probably could be fixed by using a custom DNS client implementation, which would be a massive amount of work.
            // Since PiHole already should have a static ip, just point the user to using that instead.
            throw new Error("Failed to resolve domain name to IP: " + this.base_url + ".\n"
                + "This may occur even when the domain name is reachable by a web-browser. Check the DNS records, including SOA record, or use the IP address instead.")
        }
    }

    closeConnectionLogout() {
        if (this.session_id == null || this.session_expiry_timestamp <= this.timestamp()) {
            return // nothing to do, session token is already invalid
        }
        console.log("PiHoleV6 | Closing pihole connection, logging out")
        this.httpDelete(PiHoleConnection.ENDPOINT_AUTH, true)
        this.session_id = null
    }
}

type Pihole6SessionResponse = {
    session: Pihole6Session
};

type Pihole6Session = {
    valid: boolean; // Valid session indicator (client is authenticated)
    totp: boolean; // Whether 2FA (TOTP) is enabled on this Pi-hole
    sid: string | null; // Session ID
    csrf: string | null; // CSRF token
    validity: number; // Remaining lifetime of this session unless refreshed (seconds)
    message: string | null; // Human-readable message describing the session status
}

export type Pihole6QueryListResponseEntry = { // Data array
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
};

export type Pihole6QueryListResponse = {
    queries: [Pihole6QueryListResponseEntry]
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

export type Pihole6Group = {
    name: string,
    comment: string | null,
    enabled: boolean,
    id: number,
    date_added: number,
    date_modified: number
}

export type Pihole6Domain = {
    domain: string,
    unicode: string,
    comment: string,
    type: "allow" | "deny",
    kind: "exact" | "regex" | "gravity", // gravity is not present in the pihole api, but may be used by PiHoleConnection to signal a gravity blocklist item
    groups: number[],
    enabled: boolean,
    id: number, date_added: number, date_modified: number
}

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
