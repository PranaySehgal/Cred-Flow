from sqlalchemy import text


def assignAgent(connection, aid, lat, long, date, oname, ocontact):
    query = text(
        "INSERT INTO Agents(agent_id,lat,long,date,oname,ocontact,status) VALUES(:aid,:lat,:long,:date,:oname,:ocontact,'pending')"
    )
    connection.execute(
        query,
        {
            "aid": aid,
            "lat": lat,
            "long": long,
            "time": date,
            "oname": oname,
            "ocontact": ocontact,
        },
    )


def agentDecision(connection, aid, lat, long, date, oname, ocontact, status):
    query = text(
        "Update Agents SET status = :status WHERE agent_id = :aid and oname = :oname and ocontact = :ocontact and lat = :lat and long = :long and date = :date"
    )
    connection.execute(
        query,
        {
            "aid": aid,
            "lat": lat,
            "long": long,
            "time": date,
            "oname": oname,
            "status": status,
            "ocontact": ocontact,
        },
    )
