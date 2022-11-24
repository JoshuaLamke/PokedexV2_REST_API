const merge = require("lodash/merge");

const updateExpression = (Item) => {
  const keys = Object.keys(Item);

  const ExpressionAttributeNames = keys
    .filter((attrName) => Item[attrName] !== undefined)
    .map((attrName) => ({ [`#${attrName}`]: attrName }))
    .reduce(merge, {});

  const ExpressionAttributeValues = keys
    .filter((attrName) => Item[attrName] !== undefined && Item[attrName] !== null)
    .map((attrName) => ({ [`:${attrName}`]: Item[attrName] }))
    .reduce(merge, {});

  let UpdateExpression = `SET ${keys
    .filter((attrName) => Item[attrName] !== undefined && Item[attrName] !== null)
    .map((attrName) => `#${attrName} = :${attrName}`)
    .join(', ')}`;

  const UpdateExpressionRemove = keys
    .filter((attrName) => Item[attrName] === null)
    .map((attrName) => `#${attrName}`)
    .join(', ');

  if (UpdateExpressionRemove.length) {
    UpdateExpression = `${UpdateExpression} REMOVE ${UpdateExpressionRemove}`;
  }

  return {
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    UpdateExpression,
    ReturnValues: 'ALL_NEW',
  };
};


class DynamoDBConnector {
  constructor(client, tableName) {
    this.dynamoClient = client;
    this.TableName = tableName;
  }

  scan(lastEvaluatedKey) {
    const params = {
      TableName: this.TableName,
      ...(
        lastEvaluatedKey ?
        {
          ExclusiveStartKey: lastEvaluatedKey
        } : 
        null
      )
    }
    return this.dynamoClient.scan(params).promise();
  }

  query({
    index, 
    keyName, 
    keyValue, 
    last, 
    ScanIndexForward,
    FilterExpression,
  }) {
    const params = {
      TableName: this.TableName,
      IndexName: index,
      ExclusiveStartKey: last ? JSON.parse(Buffer.from(last, 'base64').toString()) : undefined,
      KeyConditionExpression: '#keyName = :keyName',
      ExpressionAttributeNames: {
        '#keyName': keyName,
      },
      ExpressionAttributeValues: {
        ':keyName': keyValue,
      },
      FilterExpression,
      ScanIndexForward,
    };

    return this.dynamoClient.query(params).promise()
      .then((data) => ({
        last: data.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(data.LastEvaluatedKey)).toString('base64')
          : undefined,
        data: data.Items,
      }));
  }

  get(pk) {
    const params = {
      TableName: this.TableName,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': 'pk',
      },
      ExpressionAttributeValues: {
        ':pk': pk,
      },
      ConsistentRead: true,
    };

    return this.dynamoClient.query(params).promise();
  }

  batchUpdate(batch) {
    return Promise.all(
      batch.map((req) => this.update(req.key, req.inputParams)),
    );
  }

  update(Key, inputParams) {
    const params = {
      TableName: this.TableName,
      Key,
      ...updateExpression(inputParams),
    };

    return this.dynamoClient.update(params).promise();
  }
}

module.exports = DynamoDBConnector;