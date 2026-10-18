from sqlalchemy import text


def getAgentTasks(connection, agent_id):
    result = connection.execute(
        text(
            'SELECT agent_id, "Lat" AS lat, "Long" AS long, "Time", "OName", "OContact", "Status" '
            'FROM "Agents" WHERE "agent_id" = :aid ORDER BY "Time" DESC'
        ),
        {"aid": agent_id},
    )
    tasks = [dict(row) for row in result.mappings().all()]
    connection.commit()
    return tasks


def assignAgent(connection, aid, lat, long, date, oname, ocontact):
    query = text(
        """INSERT INTO "Agents"(agent_id,"Lat","Long","Time","OName","OContact","status") VALUES(:aid,:lat,:long,:date,:oname,:ocontact,'pending')"""
    )
    connection.execute(
        query,
        {
            "aid": aid,
            "lat": lat,
            "long": long,
            "date": date,
            "oname": oname,
            "ocontact": ocontact,
        },
    )
    connection.commit()


def agentDecision(connection, aid, lat, long, date, oname, ocontact, status):
    query = text(
        'UPDATE "Agents" SET status = :status WHERE agent_id = :aid AND oname = :oname '
        'AND ocontact = :ocontact AND "Lat" = :lat AND "Long" = :long AND time = :time'
    )
    result = connection.execute(
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
    connection.commit()
    if result.rowcount == 0:
        raise LookupError("This assignment could not be found for your agent account.")
    return {"STATUS": "SUCCESS", "status": status}
